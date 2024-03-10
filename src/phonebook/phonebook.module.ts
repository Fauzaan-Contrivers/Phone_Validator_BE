import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMiddleware } from 'src/middlewares/auth.middleware';
import { Phonebook } from './phonebook.entity';
import { User } from 'src/auth/user.entity';
import { Uploads } from 'src/uploads/uploads.entity';
import { PhonebookController } from './phonebook.controller';
import { PhonebookService } from './phonebook.service';

@Module({
  imports: [TypeOrmModule.forFeature([Phonebook, User, Uploads])],
  controllers: [PhonebookController],
  providers: [PhonebookService],
})
export class PhonebookModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('sheets/upload/:id');
  }
}
