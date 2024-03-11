import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(Phonebook)
    private readonly phonebookRepository: Repository<Phonebook>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Uploads)
    private readonly uploadsRepository: Repository<Uploads>,
  ) {}

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
    const uniquePhones: Set<string> = new Set();

    // Read CSV file and extract unique phone numbers
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          const phoneNumber: string = row.phone.trim();
          if (phoneNumber) {
            uniquePhones.add(phoneNumber);
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    // Filter out existing phone numbers from uniquePhones set
    const existingPhoneNumbers = await this.phonebookRepository.find({
      select: ['phoneNumber'],
    });
    existingPhoneNumbers.forEach((entry) =>
      uniquePhones.delete(entry.phoneNumber),
    );

    // Convert unique phone numbers to array of objects for bulk insertion
    const phoneEntries = Array.from(uniquePhones).map((phoneNumber) => ({
      phoneNumber,
    }));

    // Insert unique phone numbers into the database
    if (phoneEntries.length > 0) {
      await this.phonebookRepository
        .createQueryBuilder()
        .insert()
        .into(Phonebook)
        .values(phoneEntries)
        .execute();
    }
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
            const isHighlighted = adminRecords.some(
              (adminRow) => adminRow['phone'] === phoneNumber,
            );
            if (!isHighlighted) {
              rows.push(row);
            }
          } else {
            console.log('No phone number column found.');
          }
        })
        .on('end', async () => {
          if (rows.length > 0) {
            const csvWriterStream = csvWriter.createObjectCsvWriter({
              path: outputFilePath,
              header: Object.keys(rows[0]).map((header) => ({
                id: header,
                title: header,
              })),
            });
            await csvWriterStream.writeRecords(rows);
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
        createdBy: user.id,
        originalName: file.originalname,
        cleanedName: `cleaned_${file.filename}`,
      };
      const newUserSheet = await this.uploadsRepository.create(fileObj);
      await this.uploadsRepository.save(newUserSheet);
      if (!newUserSheet) {
        return { error: true, message: 'Something went wrong.' };
      }
      const adminRecords = await this.phonebookRepository.find();
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
