import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { SheetsModule } from './sheets/sheets.module';
import { Users } from './auth/users.entity';
import { Sheets } from './sheets/sheets.entity';

@Module({
  imports: [
    AuthModule,
    SheetsModule,
    TypeOrmModule.forRoot(databaseConfig),
    // TypeOrmModule.forFeature([Users, Sheets])
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
