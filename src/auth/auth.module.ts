import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Users } from './user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMiddleware } from 'src/middlewares/auth.middleware';
// import { MailgunService } from 'src/mail/mail.service';
import { MailModule } from '../mail/mail.module';
import { UserSheets } from 'src/uploads/uploads.entity';
import express from 'express';

@Module({
  imports: [TypeOrmModule.forFeature([Users, UserSheets]), MailModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('auth/create-sub-admin', 'auth/all-sheets', 'auth/all-users');
    consumer
      .apply(express.static('uploadedFiles'))
      .forRoutes({ path: 'uploadedFiles', method: RequestMethod.GET });
  }
}
