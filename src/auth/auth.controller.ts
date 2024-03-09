import { Controller, Get, Req, Res, Body, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: AuthService) {}

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ): Promise<string | { message: string }> {
    return await this.userService.login(email, password);
  }

  @Post('createAdmin')
  async createAdmin(): Promise<string | { message: string }> {
    return await this.userService.createAdminUser();
  }

  @Post('forgetPassword')
  async sendPasswordResetEmail(
    @Body('email') email: string,
  ): Promise<string | { message: string }> {
    return await this.userService.sendPasswordResetEmail(email);
  }

  @Post('changePassword')
  async changePassword(
    @Body('id') id: string,
    @Body('password') password: string,
  ): Promise<string | { message: string }> {
    return await this.userService.changePassword(id, password);
  }

  @Post('createUser')
  async createUser(
    @Body('email') email: string,
    @Body('name') name: string,
    @Req() request: Request,
  ): Promise<string | { message: string }> {
    const role = request['role'];
    return await this.userService.createUser(email, name, role);
  }

  @Get('all-sheets/:id')
  async getAllSheets(
    @Req() request: Request,
    @Param('id') id: number,
  ): Promise<string | { message: string }> {
    const role = request['role'];
    return await this.userService.getAllSheets(role, id);
  }

  @Get('/download/:name')
  async downloadCsv(
    @Param('name') name: string,
    @Res() res: Response,
  ): Promise<string | { message: string }> {
    const cleanedName = name.replace(/^:/, '');
    return await this.userService.downloadCsv(cleanedName, res);
  }

  @Get('all-users')
  async getAllUsers(
    @Req() request: Request,
  ): Promise<string | { message: string }> {
    const role = request['role'];
    return await this.userService.getAllUsers(role);
  }
}
