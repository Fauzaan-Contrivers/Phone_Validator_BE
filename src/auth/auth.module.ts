import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMiddleware } from 'src/middlewares/auth.middleware';
// import { MailgunService } from 'src/mail/mail.service';
import { MailModule } from '../mail/mail.module';
import express from 'express';
import { Uploads } from 'src/uploads/uploads.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Uploads]), MailModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes('auth/createUser', 'auth/all-sheets', 'auth/all-users');
    consumer
      .apply(express.static('uploadedFiles'))
      .forRoutes({ path: 'uploadedFiles', method: RequestMethod.GET });
  }
}
