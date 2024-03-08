import { Controller, Post, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Multer } from 'multer';
import { SheetsService } from './sheets.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheetsService: SheetsService) { }

  @Post('upload/:id')
  @UseInterceptors(FileInterceptor('image'))
  async updateSheet(
    @Param('id') id: number,
    @UploadedFile() imageFile: Multer.File,
  ) {
    try {
      return await this.sheetsService.updateSheet(id, imageFile);
    } catch (error) {
      console.error('Error uploading sheet:', error);
      return { error: true, message: 'Error uploading sheet' };
    }
  }

  @Post('upload-file/:id')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploadedFiles',
      filename: (req, file, cb) => {
        const randomName = Array(10).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async updateUserSheet(
    @Param('id') id: number,
    @UploadedFile() uploadedFile: Multer.File,
  ) {
    try {
      return await this.sheetsService.updateUserSheet(id, uploadedFile);
    } catch (error) {
      console.error('Error uploading user sheet:', error);
      return { error: true, message: 'Error uploading user sheet' };
    }
  }
}
