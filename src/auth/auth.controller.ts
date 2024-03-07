import { Controller, Get, UseGuards, Req, Res, Logger, Put, Body, Param, UseInterceptors, UploadedFile, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';
import path from 'path';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: AuthService) { }

  @Post('login')
  async loginUser(@Body('email') email: string, @Body('password') password: string): Promise<string | { message: string }> {
    console.log('password :>> ', password);
    return await this.userService.loginUser(email, password);
  }

  @Get('create-admin')
  async CreateAdmin(): Promise<string | { message: string }> {
    return await this.userService.createAdminUser();
  }
  @Post('forget-password/send-email')
  async sendEmail(@Body('email') email: string): Promise<string | { message: string }> {
    return await this.userService.sendEmail(email);
  }
  @Post('change-password')
  async changePassword(@Body('id') id: string, @Body('password') password: string): Promise<string | { message: string }> {
    return await this.userService.changePassword(id, password);
  }
  @Post('create-sub-admin')
  async createSubAdmin(@Body('email') email: string, @Body('name') name: string, @Req() request: Request): Promise<string | { message: string }> {
    const role = request["role"];
    return await this.userService.createSubAdmin(email, name, role);
  }
  @Get('all-sheets/:id')
  async GetAllSheets(@Req() request: Request, @Param('id') id: number): Promise<string | { message: string }> {
    const role = request["role"];
    return await this.userService.GetAllSheets(role, id);
  }
  @Get('/download/:name')
  async downloadCsv(@Param('name') name: string, @Res() res: Response): Promise<string | { message: string }> {
    const cleanedName = name.replace(/^:/, '');
    // console.log('cleanedName :>> ', cleanedName);
    return await this.userService.downloadCsv(cleanedName, res);
  }
  @Get('all-users')
  async GetAllUsers(@Req() request: Request): Promise<string | { message: string }> {
    const role = request["role"];
    return await this.userService.GetAllUsers(role);
  }
}
