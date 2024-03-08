import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { Users } from 'src/auth/user.entity';
import { Sheets } from 'src/phonebook/phonebook.entity';
import { UserSheets } from 'src/uploads/uploads.entity';
dotenv.config();
const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE } = process.env;

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: DB_HOST,
  port: parseInt(DB_PORT),
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  connectTimeout: 288000,
  entities: [Users, Sheets, UserSheets],
  logging: false,
  synchronize: true,
};
