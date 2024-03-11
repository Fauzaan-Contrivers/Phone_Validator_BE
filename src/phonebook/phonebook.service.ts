import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository, getConnection } from 'typeorm';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as csvWriter from 'csv-writer';
import { Phonebook } from './phonebook.entity';
import { User } from 'src/auth/user.entity';
import { Uploads } from 'src/uploads/uploads.entity';

@Injectable()
export class PhonebookService {
  phoneColumns = new Set([
    'phone number',
    'phone_number',
    'phone',
    'number',
    'telephone',
    'mobile',
    'mobile number',
    'cell',
    'cell phone',
  ]);

  constructor(
    private readonly connection: Connection,
    @InjectRepository(Phonebook)
    private readonly phonebookRepository: Repository<Phonebook>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Uploads)
    private readonly uploadsRepository: Repository<Uploads>,
  ) { }

  private async getUser(id: number) {
    return await this.userRepository.findOne({ where: { id } });
  }

  private async insertPhoneNumbers(phoneNumbers) {
    return await this.phonebookRepository.insert(phoneNumbers);
  }

  async saveAdminFileInfo(fileInfo) {
    return await this.uploadsRepository.insert(fileInfo);
  }

  async importCSV(filePath: string): Promise<void> {
    const batchSize: any = process.env.CSV_PARSING_BATCH_SIZE;
    const readStream = fs.createReadStream(filePath);
    let batch: any[] = [];

    const processBatch = async (batch: any[]) => {
      // Extract unique phone numbers from the batch
      let uniquePhones: Set<string> = new Set();

      batch.forEach((row) => {
        const phoneNumber: string = row?.Phone?.trim();
        if (phoneNumber && !uniquePhones.has(phoneNumber)) {
          uniquePhones.add(phoneNumber);
        }
      });

      const phoneEntries = Array.from(uniquePhones).map((phoneNumber) => ({
        phoneNumber,
      }));

      if (phoneEntries.length > 0) {
        const values = phoneEntries
          .map(entry => `('${entry.phoneNumber}')`)
          .join(',');

        const rawQuery = `
          INSERT INTO phonebook (\`phoneNumber\`)
          VALUES ${values}
          ON DUPLICATE KEY UPDATE \`phoneNumber\` = \`phoneNumber\`
        `;

        await this.phonebookRepository.query(rawQuery);
      }
    };

    return new Promise<void>((resolve, reject) => {
      readStream
        .pipe(csvParser())
        .on('data', (row) => {
          batch.push(row);

          if (batch.length == batchSize) {
            processBatch(batch)
              .then(() => {
                batch = []; // Clear the batch array
              })
              .catch((error) => {
                reject(error);
              });
          }
        })
        .on('end', async () => {
          try {
            // Process the remaining rows if any (for the last batch)
            if (batch.length > 0) {
              await processBatch(batch);
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          console.log("error", error);
          reject(error);
        });
    });
  }




  private async isFileExtensionValid(filename: string) {
    const nameParts = filename.split('.');
    if (
      nameParts &&
      nameParts.length > 0 &&
      nameParts[1].toString().toLocaleLowerCase() === 'csv'
    ) {
      return true;
    }
    return false;
  }

  private async processCSVFile(bufferStream, user) {
    const results = [];
    bufferStream.pipe(csvParser()).on('data', (row) => {
      for (const key of Object.keys(row)) {
        if (this.phoneColumns.has(key.toLowerCase())) {
          results.push({ phone: row[key], user });
          break;
        }
      }
    });
    return new Promise((resolve, reject) => {
      bufferStream
        .on('end', async () => {
          try {
            const existingNumbers = await this.phonebookRepository.find();
            const uniquePhoneNumbers = results.filter((newEntry) => {
              return !existingNumbers.some(
                (existingEntry) =>
                  existingEntry.phoneNumber === newEntry.phoneNumber,
              );
            });
            if (uniquePhoneNumbers.length > 0) {
              await this.insertPhoneNumbers(uniquePhoneNumbers);
            }
            resolve({ error: false, message: 'Sheet uploaded' });
          } catch (error) {
            reject({ error: true, message: error?.message });
          }
        })
        .on('error', (error) => {
          console.error('Error parsing CSV:', error);
          reject({ error: true, message: error?.message });
        });
    });
  }

  private async processCSVFileForUser(
    inputFilePath,
    outputFilePath,
    adminRecords,
  ) {
    if (fs.existsSync(inputFilePath)) {
      const rows = [];
      const stream = fs
        .createReadStream(inputFilePath)
        .pipe(csvParser())
        .on('data', (row) => {
          const phoneNumberColumn = Object.keys(row).find((column) =>
            Array.from(this.phoneColumns).some((phoneColumn) =>
              column.toLowerCase().includes(phoneColumn.toLowerCase()),
            ),
          );
          if (phoneNumberColumn) {
            const phoneNumber = row[phoneNumberColumn];
            // const isHighlighted = adminRecords.some(
            //   (adminRow) => adminRow['phone'] === phoneNumber,
            // );
            //  if (!isHighlighted) {
            rows.push(row);
            // }
          } else {
            console.log('No phone number column found.');
          }
        })
        .on('end', async () => {
          if (rows.length > 0) {
            const tableName = `temp_table_${Date.now()}`;  // Create a unique table name
            console.log("IO am here")
            await this.connection.query(`
              CREATE TABLE ${tableName} (
                id SERIAL PRIMARY KEY,
                phoneNumber VARCHAR(255) NOT NULL 
              )
            `);
            const values = rows
              .map(entry => `('${entry.Phone}')`)
              .join(',');
            await this.connection.query(`
            INSERT INTO ${tableName} (\`phoneNumber\`)
               VALUES ${values}
               ON DUPLICATE KEY UPDATE \`phoneNumber\` = \`phoneNumber\`
               `);

            const query = `
      SELECT temp.phoneNumber
      FROM ${tableName} temp
      LEFT JOIN phonebook main ON temp.phoneNumber = main.phoneNumber
      WHERE main.phoneNumber IS NULL
    `;

            const results = await this.connection.query(query);
            const csvWriterStream = csvWriter.createObjectCsvWriter({
              path: outputFilePath,
              header: Object.keys(rows[0]).map((header) => ({
                id: header,
                title: header,
              })),
            });
            const updatedData = results.map(item => ({ Phone: item.phoneNumber }));

            await csvWriterStream.writeRecords(updatedData);
            console.log('CSV writing completed.');
          } else {
            console.log('No matching rows found. Output file not created.');
          }
        })
        .on('error', (error) => {
          console.error('Error processing CSV:', error);
        });
    } else {
      console.log('File not found.');
    }
  }

  async updateSheet(
    id: number,
    file,
  ): Promise<{ error: boolean; message: string }> {
    try {
      const user = await this.getUser(id);
      if (!user || user.role !== 'admin') {
        return {
          error: true,
          message: 'Invalid user or user cannot perform this action.',
        };
      }
      const bufferStream = new Readable({
        read() {
          this.push(file.buffer);
          this.push(null);
        },
      });
      await this.processCSVFile(bufferStream, user);
      return { error: false, message: 'Sheet Uploaded.' };
    } catch (error) {
      console.error('Error:', error);
      return { error: true, message: error.message };
    }
  }

  async updateUserSheet(
    id: number,
    file,
  ): Promise<{ error: boolean; message: string }> {
    try {
      const user = await this.getUser(id);
      if (!user) {
        return { error: true, message: 'Invalid User Id.' };
      }
      const fileObj = {
        fileName: file.filename,
        fileType: 'original',
        createdBy: { id: user.id },
        originalName: file.originalname,
        cleanFileName: `cleaned_${file.filename}`,
      };
      const newUserSheet = await this.uploadsRepository.create(fileObj);
      await this.uploadsRepository.save(newUserSheet);
      if (!newUserSheet) {
        return { error: true, message: 'Something went wrong.' };
      }
      const adminRecords = []
      // const adminRecords = await this.phonebookRepository.find({
      //   take: 10, // Retrieve only the first 10 records
      // });

      const inputFilePath = path.join(
        __dirname,
        '../../uploadedFiles',
        file.filename,
      );
      const outputFilePath = path.join(
        __dirname,
        '../../uploadedFiles',
        `cleaned_${file.filename}`,
      );
      await this.processCSVFileForUser(
        inputFilePath,
        outputFilePath,
        adminRecords,
      );
      return { error: false, message: 'Sheet uploaded.' };
    } catch (error) {
      console.error('Error:', error);
      return { error: true, message: error.message };
    }
  }
}
