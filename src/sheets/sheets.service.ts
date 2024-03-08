import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Sheets } from './sheets.entity';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { Users } from 'src/auth/users.entity';
import csvParser from 'csv-parser';
import { UserSheets } from 'src/userSheets/userSheets.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as csvWriter from 'csv-writer';

@Injectable()
export class SheetsService {
  phoneColumns = [
    'Phone number',
    'phone_number',
    'Phone',
    'Number',
    'Telephone',
    'Mobile',
    'Mobile number',
    'Cell',
    'Cell Phone',
  ];
  constructor(
    @InjectRepository(Sheets)
    private readonly sheetsRepository: Repository<Sheets>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(UserSheets)
    private readonly userSheetsRepository: Repository<UserSheets>,
  ) {}

  async updateSheet(
    id: number,
    file,
  ): Promise<{ error: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return {
          error: true,
          message: 'Invalid Id.',
        };
      }
      if (user?.role != 'admin') {
        return {
          error: true,
          message: 'This user cannot perform this action.',
        };
      }

      const processingPromise = new Promise(async (resolve, reject) => {
        const results = []; // Array to store extracted phone numbers

        const bufferStream = new Readable({
          read() {
            this.push(file.buffer); // Push the entire buffer to the stream
            this.push(null); // Signal end of stream
          },
        });

        bufferStream
          .pipe(csvParser()) // Adjust delimiter if needed
          .on('data', (row) => {
            // Extract phone number using regular expression or library
            for (const key in row) {
              // Check if the current key is 'Phone number'
              if (
                this.phoneColumns.some(
                  (column) => column.toLowerCase() === key.toLowerCase(),
                )
              ) {
                // Access and print the value
                results.push(row[key]);
                break;
              }
            }
          })
          .on('end', async () => {
            const phoneNumbers = results.map((phoneNumber) => ({
              phone: phoneNumber,
              user: user,
            })); // Prepare data
            const existingNumbers = await this.sheetsRepository.find();
            const uniquePhoneNumbers = phoneNumbers.filter((newEntry) => {
              return !existingNumbers.some(
                (existingEntry) => existingEntry.phone === newEntry.phone,
              );
            });
            try {
              if (uniquePhoneNumbers.length > 0) {
                await this.sheetsRepository.insert(uniquePhoneNumbers);
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

      await processingPromise;

      return { error: false, message: 'Sheet Uploaded.' };
    } catch (error) {
      console.log('error :>> ', error);
      return { error: true, message: error.message };
    }
  }

  async updateUserSheet(
    id: number,
    file,
  ): Promise<{ error: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return {
          error: true,
          message: 'Invalid User Id.',
        };
      }
      const newUserSheet = await this.userSheetsRepository.create({
        fileName: file.filename,
        fileType: 'original',
        user: { id: user.id },
        originalName: file.originalname,
        cleanedName: `cleaned_${file.filename}`,
      });
      await this.userSheetsRepository.save(newUserSheet);
      if (!newUserSheet) {
        return { error: true, message: 'Something went wrong.' };
      }
      const adminRecords = await this.sheetsRepository.find();

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

      if (fs.existsSync(inputFilePath)) {
        console.log('Input file found at:', inputFilePath);

        const processingPromise = new Promise((resolve, reject) => {
          const rows = [];
          const stream = fs
            .createReadStream(inputFilePath)
            .pipe(csvParser())
            .on('data', (row) => {
              const phoneNumberColumn = Object.keys(row).find((column) =>
                this.phoneColumns.some((phoneColumn) =>
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
            .on('end', () => {
              if (rows.length > 0) {
                const csvWriterStream = csvWriter.createObjectCsvWriter({
                  path: outputFilePath,
                  header: Object.keys(rows[0]).map((header) => ({
                    id: header,
                    title: header,
                  })),
                });
                csvWriterStream
                  .writeRecords(rows)
                  .then(() => {
                    console.log('CSV writing completed.');
                    resolve({ error: false, message: 'Sheet uploaded' });
                  })
                  .catch((error) => {
                    console.error('Error writing CSV:', error);
                    reject(error);
                  });
              } else {
                console.log('No matching rows found. Output file not created.');
                resolve({ error: false, message: 'Sheet uploaded' });
              }
            })
            .on('error', (error) => {
              console.error('Error processing CSV:', error);
              reject(error);
            });
        });

        await processingPromise;
      } else {
        console.log('File not found.');
      }
      return { error: false, message: 'Sheet uploaded.' };
    } catch (error) {
      return { error: true, message: error.message };
    }
  }
}
