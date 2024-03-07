import { Module,MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMiddleware } from 'src/middlewares/auth.middleware';
import { SheetsController } from './sheets.controller';
import { SheetsService } from './sheets.service';
import { Sheets } from './sheets.entity';
import { Users } from 'src/auth/users.entity';
import { UserSheets } from 'src/userSheets/userSheets.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sheets,Users,UserSheets]),
  ],
  controllers: [SheetsController],
  providers: [SheetsService]
})
export class SheetsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('sheets/upload/:id');
  }
}
