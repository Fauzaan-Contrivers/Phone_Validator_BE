import { Controller, Get, UseGuards, Req, Res, Logger, Put, Body, Param, UseInterceptors, UploadedFile, Post } from '@nestjs/common';
import { SheetsService } from './sheets.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Multer,diskStorage } from 'multer';
import { extname } from 'path'


@Controller('sheets')
export class SheetsController {
    constructor(
        private readonly sheetsService: SheetsService) {}

        @Post('upload/:id')
        @UseInterceptors(FileInterceptor('image')) 
        async updateSheet(
          @Param('id') id: number,
          @UploadedFile() image: Multer.File, 
        ) {
          // Pass image along with other payload data to service for update
          return this.sheetsService.updateSheet(id, image);
        }
        @Post('upload-file/:id')
        @UseInterceptors(FileInterceptor('file',{
          storage:diskStorage({
            destination:"./uploadedFiles", filename: (req, file, cb) => {
              // Generating a 32 random chars long string
              const randomName = Array(10).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('')
              //Calling the callback passing the random name generated with the original extension name
              cb(null, `${randomName}${extname(file.originalname)}`)
            }
          })
        })) 
        async updateUserSheet(
          @Param('id') id: number,
          @UploadedFile() file: Multer.File, 
        ) {
          // Pass image along with other payload data to service for update
          return this.sheetsService.updateUserSheet(id, file);
        }

}
