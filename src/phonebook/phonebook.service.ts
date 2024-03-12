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
  phoneColumns = [
    'phone number',
    'phone_number',
    'phone',
    'number',
    'telephone',
    'mobile',
    'cell',
  ];

  constructor(
    private readonly connection: Connection,
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

  async saveAdminFileInfo(fileInfo: any): Promise<any> {
    const upload = await this.uploadsRepository.insert(fileInfo);
    return upload;
  }

  async importCSV(filePath: string, fileInfo: any): Promise<void> {
    console.log('import CSV Called');
    const batchSize: number = +process.env.CSV_PARSING_BATCH_SIZE || 1000;
    const readStream = fs.createReadStream(filePath);
    let batch: any[] = [];
    let totalCount = 0;
    const totalPhonebookResult = await this.phonebookRepository.query(
      'SELECT COUNT(*) AS total_count FROM phonebook;',
    );

    const totalBeforePhonebookCount = parseInt(
      totalPhonebookResult[0]?.total_count,
    );
    const columns = [];
    const stream = fs
      .createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (columns.length === 0) {
          columns.push(...Object.keys(row));
        }
      });

    let phoneNumberColumnFromCSV = '';
    for (let i = 0; i < columns.length; i++) {
      const columnName = columns[i];
      if (this.phoneColumns.includes(columnName.toLowerCase())) {
        phoneNumberColumnFromCSV = columnName;
        break;
      }
    }

    if (!phoneNumberColumnFromCSV) {
      console.log('No phone number column found.');
      return;
    }

    const processBatch = async (batch: any[]) => {
      const uniquePhones = new Set<string>();

      batch.forEach((row) => {
        const phoneNumber: string = row[phoneNumberColumnFromCSV]?.trim();
        if (phoneNumber) {
          totalCount++;
          uniquePhones.add(phoneNumber);
        }
      });

      const phoneEntries = Array.from(uniquePhones).map((phoneNumber) => ({
        phoneNumber,
      }));

      if (phoneEntries.length > 0) {
        await this.phonebookRepository
          .createQueryBuilder()
          .insert()
          .into(Phonebook)
          .values(phoneEntries)
          .orIgnore()
          .execute();
      }
    };

    return new Promise<void>((resolve, reject) => {
      readStream
        .pipe(csvParser())
        .on('data', (row) => {
          batch.push(row);

          if (batch.length === batchSize) {
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
            const afterInsertionPhonebook =
              await this.phonebookRepository.query(
                'SELECT COUNT(*) AS total_count FROM phonebook;',
              );

            const totalPhonebookCount = parseInt(
              afterInsertionPhonebook[0]?.total_count,
            );
            const unique = totalPhonebookCount - totalBeforePhonebookCount;

            fileInfo.totalCount = totalCount;
            fileInfo.cleaned = unique;
            fileInfo.duplicate = totalCount - unique;
            await this.saveAdminFileInfo(fileInfo);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  // async importCSV(filePath: string): Promise<void> {
  //   const batchSize: any = process.env.CSV_PARSING_BATCH_SIZE;
  //   const readStream = fs.createReadStream(filePath);
  //   let batch: any[] = [];

  //   const processBatch = async (batch: any[]) => {
  //     // Extract unique phone numbers from the batch
  //     let uniquePhones: Set<string> = new Set();

  //     const phoneProperties = [
  //       'Phone number',
  //       'Phone Number',
  //       'Phone',
  //       'Number',
  //       'Telephone',
  //       'Mobile',
  //       'Mobile number',
  //       'Cell',
  //       'Cell Phone',
  //       'phone_number',
  //       'Phone_Number',
  //       'Phone_number',
  //       'phone number',
  //       'phone',
  //       'number',
  //       'telephone',
  //     ];

  //     batch.forEach((row) => {
  //       const phoneNumberProperty = phoneProperties.find((property) =>
  //         row?.[property]?.trim(),
  //       );
  //       const phoneNumber: string = row?.[phoneNumberProperty]?.trim();
  //       if (phoneNumber && !uniquePhones.has(phoneNumber)) {
  //         uniquePhones.add(phoneNumber.trim());
  //       }
  //     });

  //     const phoneEntries = Array.from(uniquePhones).map((phoneNumber) => ({
  //       phoneNumber,
  //     }));

  //     if (phoneEntries.length > 0) {
  //       const values = phoneEntries
  //         .map((entry) => `('${entry.phoneNumber}')`)
  //         .join(',');

  //       const rawQuery = `
  //         INSERT INTO phonebook (\`phoneNumber\`)
  //         VALUES ${values}
  //         ON DUPLICATE KEY UPDATE \`phoneNumber\` = \`phoneNumber\`
  //       `;

  //       await this.phonebookRepository.query(rawQuery);
  //     }
  //   };

  //   return new Promise<void>((resolve, reject) => {
  //     readStream
  //       .pipe(csvParser())
  //       .on('data', (row) => {
  //         batch.push(row);

  //         if (batch.length == batchSize) {
  //           processBatch(batch)
  //             .then(() => {
  //               batch = []; // Clear the batch array
  //             })
  //             .catch((error) => {
  //               reject(error);
  //             });
  //         }
  //       })
  //       .on('end', async () => {
  //         try {
  //           // Process the remaining rows if any (for the last batch)
  //           if (batch.length > 0) {
  //             await processBatch(batch);
  //           }
  //           resolve();
  //         } catch (error) {
  //           reject(error);
  //         }
  //       })
  //       .on('error', (error) => {
  //         console.log('error', error);
  //         reject(error);
  //       });
  //   });
  // }

  // private async processCSVFile(bufferStream, user) {
  //   const results = [];
  //   bufferStream.pipe(csvParser()).on('data', (row) => {
  //     for (const key of Object.keys(row)) {
  //       if (this.phoneColumns.has(key.toLowerCase())) {
  //         results.push({ phone: row[key], user });
  //         break;
  //       }
  //     }
  //   });
  //   return new Promise((resolve, reject) => {
  //     bufferStream
  //       .on('end', async () => {
  //         try {
  //           const existingNumbers = await this.phonebookRepository.find();
  //           const uniquePhoneNumbers = results.filter((newEntry) => {
  //             return !existingNumbers.some(
  //               (existingEntry) =>
  //                 existingEntry.phoneNumber === newEntry.phoneNumber,
  //             );
  //           });
  //           if (uniquePhoneNumbers.length > 0) {
  //             await this.insertPhoneNumbers(uniquePhoneNumbers);
  //           }
  //           resolve({ error: false, message: 'Sheet uploaded' });
  //         } catch (error) {
  //           reject({ error: true, message: error?.message });
  //         }
  //       })
  //       .on('error', (error) => {
  //         console.error('Error parsing CSV:', error);
  //         reject({ error: true, message: error?.message });
  //       });
  //   });
  // }

  // private async processCSVFileForUser(
  //   inputFilePath,
  //   outputFilePath,
  //   flaggedFilePath,
  // ) {
  //   if (fs.existsSync(inputFilePath)) {
  //     let phoneNumberColumnFromCSV = '';
  //     const rows = [];
  //     const stream = fs
  //       .createReadStream(inputFilePath)
  //       .pipe(csvParser())
  //       .on('data', (row) => {
  //         const phoneNumberColumn = Object.keys(row).find((column) =>
  //           Array.from(this.phoneColumns).some((phoneColumn) =>
  //             column.toLowerCase().includes(phoneColumn.toLowerCase()),
  //           ),
  //         );
  //         if (phoneNumberColumn) {
  //           phoneNumberColumnFromCSV = phoneNumberColumn;
  //           rows.push(row);
  //         } else {
  //           console.log('No phone number column found.');
  //         }
  //       })
  //       .on('end', async () => {
  //         if (rows.length > 0) {
  //           const tableName = `temp_table_${Date.now()}`; // Create a unique table name
  //           await this.connection.query(`
  //             CREATE TABLE ${tableName} (
  //               id SERIAL PRIMARY KEY,
  //               phoneNumber VARCHAR(255) NOT NULL
  //             )
  //           `);
  //           const values = rows
  //             .map((entry) => `('${entry[phoneNumberColumnFromCSV]}')`)
  //             .join(',');
  //           await this.connection.query(`
  //           INSERT INTO ${tableName} (\`phoneNumber\`)
  //              VALUES ${values}
  //              ON DUPLICATE KEY UPDATE \`phoneNumber\` = \`phoneNumber\`
  //              `);

  //           const query = `
  //     SELECT temp.phoneNumber
  //     FROM ${tableName} temp
  //     LEFT JOIN phonebook main ON temp.phoneNumber = main.phoneNumber
  //     WHERE main.phoneNumber IS NULL
  //   `;
  //           const flaggedNumbersQuery = `
  //     SELECT temp.phoneNumber
  //     FROM ${tableName} temp
  //     LEFT JOIN phonebook main ON temp.phoneNumber = main.phoneNumber
  //     WHERE main.phoneNumber IS NOT NULL
  //   `;
  //           const results = await this.connection.query(query);
  //           const flaggedNumbers =
  //             await this.connection.query(flaggedNumbersQuery);

  //           const csvWriterStream = csvWriter.createObjectCsvWriter({
  //             path: outputFilePath,
  //             header: Object.keys(rows[0]).map((header) => ({
  //               id: header,
  //               title: header,
  //             })),
  //           });

  //           const csvWriterStream2 = csvWriter.createObjectCsvWriter({
  //             path: flaggedFilePath,
  //             header: Object.keys(rows[0]).map((header) => ({
  //               id: header,
  //               title: header,
  //             })),
  //           });

  //           const updatedData = results.map((item) => ({
  //             [phoneNumberColumnFromCSV]: item.phoneNumber,
  //           }));
  //           const flaggedNumbersArray = flaggedNumbers.map((item) => ({
  //             [phoneNumberColumnFromCSV]: item.phoneNumber,
  //           }));
  //           //  const phoneNumbersString = flaggedNumbersArray.join(', '); // You can specify a separator if needed

  //           await csvWriterStream.writeRecords(updatedData);
  //           await csvWriterStream2.writeRecords(flaggedNumbersArray);

  //           console.log('CSV writing completed.');
  //         } else {
  //           console.log('No matching rows found. Output file not created.');
  //         }
  //       })
  //       .on('error', (error) => {
  //         console.error('Error processing CSV:', error);
  //       });
  //   } else {
  //     console.log('File not found.');
  //   }
  // }

  // async updateSheet(
  //   id: number,
  //   file,
  // ): Promise<{ error: boolean; message: string }> {
  //   try {
  //     const user = await this.getUser(id);
  //     if (!user || user.role !== 'admin') {
  //       return {
  //         error: true,
  //         message: 'Invalid user or user cannot perform this action.',
  //       };
  //     }
  //     const bufferStream = new Readable({
  //       read() {
  //         this.push(file.buffer);
  //         this.push(null);
  //       },
  //     });
  //     await this.processCSVFile(bufferStream, user);
  //     return { error: false, message: 'Sheet Uploaded.' };
  //   } catch (error) {
  //     console.error('Error:', error);
  //     return { error: true, message: error.message };
  //   }
  // }

  // async updateUserSheet(
  //   id: number,
  //   file,
  // ): Promise<{ error: boolean; message: string }> {
  //   try {
  //     const user = await this.getUser(id);
  //     if (!user) {
  //       return { error: true, message: 'Invalid User Id.' };
  //     }
  //     const fileObj = {
  //       fileName: file.filename,
  //       fileType: 'original',
  //       flaggedFileName: `flagged_${file.filename}`,
  //       createdBy: { id: user.id },
  //       originalName: file.originalname,
  //       cleanFileName: `cleaned_${file.filename}`,
  //     };
  //     const newUserSheet = await this.uploadsRepository.create(fileObj);
  //     await this.uploadsRepository.save(newUserSheet);
  //     if (!newUserSheet) {
  //       return { error: true, message: 'Something went wrong.' };
  //     }

  //     const inputFilePath = path.join(
  //       __dirname,
  //       '../../uploadedFiles',
  //       file.filename,
  //     );
  //     const outputFilePath = path.join(
  //       __dirname,
  //       '../../uploadedFiles',
  //       `cleaned_${file.filename}`,
  //     );

  //     const flaggedFilePath = path.join(
  //       __dirname,
  //       '../../uploadedFiles',
  //       `flagged_${file.filename}`,
  //     );

  //     await this.processCSVFileForUser(
  //       inputFilePath,
  //       outputFilePath,
  //       flaggedFilePath,
  //     );
  //     return { error: false, message: 'Sheet uploaded.' };
  //   } catch (error) {
  //     console.error('Error:', error);
  //     return { error: true, message: error.message };
  //   }
  // }

  async updateUserSheet(
    id: number,
    file,
  ): Promise<{ error: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return { error: true, message: 'Invalid User Id.' };
      }

      const fileObj = {
        fileName: file.filename,
        fileType: 'original',
        flaggedFileName: `flagged_${file.filename}`,
        createdBy: user,
        originalName: file.originalname,
        cleanFileName: `cleaned_${file.filename}`,
      };

      const newUserSheet = await this.uploadsRepository.save(fileObj);
      if (!newUserSheet) {
        return { error: true, message: 'Something went wrong.' };
      }

      const inputFilePath = path.join(
        __dirname,
        '../../uploadedFiles',
        file.filename,
      );
      const outputFilePath = path.join(
        __dirname,
        '../../uploadedFiles',
        fileObj.cleanFileName,
      );
      const flaggedFilePath = path.join(
        __dirname,
        '../../uploadedFiles',
        fileObj.flaggedFileName,
      );

      await this.processCSVFileForUser(
        inputFilePath,
        outputFilePath,
        flaggedFilePath,
        fileObj,
      );

      return { error: false, message: 'Sheet uploaded.' };
    } catch (error) {
      console.error('Error:', error);
      return { error: true, message: error.message };
    }
  }

  private async createTemporaryTable(
    tableName: string,
    columns: string[],
  ): Promise<void> {
    const columnDefinitions = columns.map((column) => `${column} TEXT`);
    await this.connection.query(`
      CREATE TEMP TABLE ${tableName} (
        id SERIAL PRIMARY KEY,
        duplicate BOOLEAN DEFAULT FALSE,
        ${columnDefinitions.join(', ')}
      )
    `);
  }

  private async insertDataIntoTemporaryTable(
    tableName: string,
    rows: any[],
    columns: string[],
  ): Promise<void> {
    const columnNames = columns.join(', ');
    const values = rows
      .map(
        (row) =>
          `(${columns.map((column) => `'${row[column] || ''}'`).join(', ')})`,
      )
      .join(', ');

    await this.connection.query(`
      INSERT INTO ${tableName} (${columnNames})
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `);
  }

  private async fetchUnflaggedNumbers(
    tableName: string,
    phoneNumberColumnFromCSV: string,
  ): Promise<string[]> {
    const query = `
      SELECT *
      FROM ${tableName}
      WHERE ${phoneNumberColumnFromCSV} NOT IN (SELECT phoneNumber FROM phonebook)
    `;

    const result = await this.connection.query(query);
    return result;
  }

  private async fetchFlaggedNumbers(
    tableName: string,
    phoneNumberColumnFromCSV: string,
  ): Promise<string[]> {
    const query = `
      SELECT *
      FROM ${tableName}
      WHERE ${phoneNumberColumnFromCSV} IN (SELECT phoneNumber FROM phonebook)
    `;

    const result = await this.connection.query(query);
    return result;
  }

  async processCSVFileForUser(
    inputFilePath: string,
    outputFilePath: string,
    flaggedFilePath: string,
    fileObj: any,
  ): Promise<void> {
    if (!fs.existsSync(inputFilePath)) {
      console.log('File not found.');
      return;
    }

    const rows: any[] = [];
    const columns: string[] = [];

    const stream = fs
      .createReadStream(inputFilePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (columns.length === 0) {
          columns.push(...Object.keys(row));
        }

        rows.push(row);
      })
      .on('end', async () => {
        if (rows.length === 0) {
          console.log(
            'No data found in the CSV file. Output files not created.',
          );
          return;
        }

        let phoneNumberColumnFromCSV = '';
        for (let i = 0; i < columns.length; i++) {
          const columnName = columns[i];
          if (this.phoneColumns.includes(columnName)) {
            phoneNumberColumnFromCSV = columnName;
            break;
          }
        }

        if (!phoneNumberColumnFromCSV) {
          console.log('No phone number column found.');
          return;
        }

        const tableName = `temp_table_${Date.now()}`;
        await this.createTemporaryTable(tableName, columns);
        await this.insertDataIntoTemporaryTable(tableName, rows, columns);

        const unflaggedData = await this.fetchUnflaggedNumbers(
          tableName,
          phoneNumberColumnFromCSV,
        );
        const flaggedData = await this.fetchFlaggedNumbers(
          tableName,
          phoneNumberColumnFromCSV,
        );

        const csvWriterStream = csvWriter.createObjectCsvWriter({
          path: outputFilePath,
          header: columns.map((column) => ({
            id: column,
            title: column,
          })),
        });

        const csvWriterStream2 = csvWriter.createObjectCsvWriter({
          path: flaggedFilePath,
          header: columns.map((column) => ({
            id: column,
            title: column,
          })),
        });

        const unflaggedDataObjects = unflaggedData.map((row) => {
          const rowData: any = {};
          for (let i = 0; i < row.length; i++) {
            rowData[columns[i]] = row[i];
          }
          return rowData;
        });

        const flaggedDataObjects = flaggedData.map((row) => {
          const rowData: any = {};
          for (let i = 0; i < row.length; i++) {
            rowData[columns[i]] = row[i];
          }
          return rowData;
        });

        await csvWriterStream.writeRecords(unflaggedDataObjects);
        await csvWriterStream2.writeRecords(flaggedDataObjects);

        console.log('CSV writing completed.');
      })
      .on('error', (error) => {
        console.error('Error processing CSV:', error);
      });
  }
}
