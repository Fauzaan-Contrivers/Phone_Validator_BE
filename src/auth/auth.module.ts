import { Module,MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Users } from './users.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMiddleware } from 'src/middlewares/auth.middleware';
import { MailgunService } from 'src/mailgun/mailgun.service';
import { UserSheets } from 'src/userSheets/userSheets.entity';
import  express  from 'express';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users,UserSheets])
  ],
  controllers: [AuthController],
  providers: [AuthService,MailgunService]
})
export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('auth/create-sub-admin','auth/all-sheets','auth/all-users');
    consumer.apply(express.static('uploadedFiles'))
  .forRoutes({ path: 'uploadedFiles', method: RequestMethod.GET });
  }
}
