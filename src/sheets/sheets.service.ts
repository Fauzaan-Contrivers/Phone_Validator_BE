import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Sheets } from './sheets.entity';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { Users } from 'src/auth/users.entity';
import { UserSheets } from 'src/userSheets/userSheets.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as csvWriter from 'csv-writer';

@Injectable()
export class SheetsService {
  phoneColumns = new Set([
    'Phone number',
    'phone_number',
    'Phone',
    'Number',
    'Telephone',
    'Mobile',
    'Mobile number',
    'Cell',
    'Cell Phone',
  ]);

  constructor(
    @InjectRepository(Sheets)
    private readonly sheetsRepository: Repository<Sheets>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(UserSheets)
    private readonly userSheetsRepository: Repository<UserSheets>,
  ) { }

  private async getUser(id: number) {
    return await this.userRepository.findOne({ where: { id } });
  }

  private async insertPhoneNumbers(phoneNumbers) {
    return await this.sheetsRepository.insert(phoneNumbers);
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
            const existingNumbers = await this.sheetsRepository.find();
            const uniquePhoneNumbers = results.filter((newEntry) => {
              return !existingNumbers.some(
                (existingEntry) => existingEntry.phone === newEntry.phone,
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
