import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Multer } from 'multer';
import { PhonebookService } from './phonebook.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('sheets')
export class PhonebookController {
  constructor(private readonly phonebookService: PhonebookService) {}

  @Post('upload/:id')
  @UseInterceptors(FileInterceptor('file'))
  async ImportCSV(@Param('id') id: number, @UploadedFile() file: Multer.File) {
    try {
      const fileInfo = {
        filename: '',
        createdBy: '',
      };
      await this.phonebookService.saveAdminFileInfo(fileInfo);
      const resp = await this.phonebookService.importCSV(file);
      return resp;
    } catch (error) {
      console.error('An error occured while importing csv file:', error);
      return {
        error: true,
        message: 'An error occured while importing csv file',
      };
    }
  }

  @Post('upload/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateSheet(
    @Param('id') id: number,
    @UploadedFile() imageFile: Multer.File,
  ) {
    try {
      return await this.phonebookService.updateSheet(id, imageFile);
    } catch (error) {
      console.error('Error uploading sheet:', error);
      return { error: true, message: 'Error uploading sheet' };
    }
  }

  @Post('upload-file/:id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploadedFiles',
        filename: (req, file, cb) => {
          const randomName = Array(10)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async updateUserSheet(
    @Param('id') id: number,
    @UploadedFile() uploadedFile: Multer.File,
  ) {
    try {
      return await this.phonebookService.updateUserSheet(id, uploadedFile);
    } catch (error) {
      console.error('Error uploading user sheet:', error);
      return { error: true, message: 'Error uploading user sheet' };
    }
  }
}
