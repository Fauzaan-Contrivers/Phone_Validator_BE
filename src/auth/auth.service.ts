import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { Uploads } from 'src/uploads/uploads.entity';
import path from 'path';
import * as fs from 'fs';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Uploads)
    private readonly phonebookRepository: Repository<Uploads>,
    private mailService: MailService,
  ) { }

  async login(email: string, password: string): Promise<any> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        return {
          error: true,
          message: 'User not found',
        };
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return {
          error: true,
          message: 'Incorrect password',
        };
      }

      const jwtToken = this.generateToken(user);
      return {
        error: false,
        token: jwtToken,
        email: user.email,
        id: user.id,
        role: user.role,
      };
    } catch (e) {
      return {
        error: true,
        messsage: e?.message,
      };
    }
  }

  async sendPasswordResetEmail(email: string, subject: string) {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        return {
          error: true,
          message: 'User with this email not found.',
        };
      }
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user?.role,
      };

      const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '10m',
      });
      await this.mailService.sendPasswordResetEmail(user, jwtToken, subject);
      return { error: false, message: 'Email sent successfully.' };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        error: true,
        message: error?.message,
      };
    }
  }

  async changePassword(id: string, password: string) {
    try {
      if (!id || !password) {
        return {
          error: true,
          message: 'Provide all the fields.',
        };
      }
      const user = jwt.verify(id, process.env.JWT_SECRET);
      if (!user) {
        return {
          error: true,
          message: 'User not found.',
        };
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user's password in the database
      user.password = hashedPassword;
      const updatedUser = await this.userRepository.save(user);
      if (updatedUser) {
        return {
          error: false,
          message: 'Password changed.',
        };
      }
    } catch (error) {
      return {
        error: true,
        message: 'Cannot change password.',
      };
    }
  }

  generatePassword(length: number = 12): string {
    const buffer = randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
  }

  private generateToken(user: any): string {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user?.role,
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
  }

  async createAdminUser(): Promise<any> {
    try {
      const existingAdmin = await this.userRepository.findOne({
        where: { email: 'admin@admin.com' },
      });
      if (existingAdmin) {
        return { error: true, message: 'Admin user already created' };
      }

      const adminUser = this.userRepository.create({
        name: 'admin',
        email: 'admin@admin.com',
        password: await bcrypt.hash('1234', 10),
        role: 'admin',
      });

      await this.userRepository.save(adminUser);
      return { error: false, message: 'Admin user successfully created.' };
    } catch (e) {
      console.log(e);
      return { error: true, message: 'Admin user not created.' };
    }
  }

  async createUser(email: string, name: string, role: string, uploadLimit: number) {
    try {
      if (!email || !name) {
        return {
          error: true,
          message: 'All fields are required',
        };
      }
      if (role === 'admin') {
        const userExists = await this.userRepository.findOne({
          where: { email },
        });
        if (userExists) {
          return { error: true, message: 'User already exists' };
        }
        const user = this.userRepository.create({
          name,
          email,
          password: null,
          role: 'user',
          uploadLimit,
          availableLimit: uploadLimit
        });

        const subject = "Set your new password";
        await this.userRepository.save(user);
        await this.sendPasswordResetEmail(email, subject);
        return { error: false, message: 'User created' };
      } else {
        return {
          error: true,
          message: 'You are not allowed to perform this action.',
        };
      }
    } catch (error) {
      return { error: true, message: error?.message };
    }
  }

  async updateUser(userId: number, uploadLimit: number) {
    try {
      if (!userId || !uploadLimit) {
        return {
          error: true,
          message: 'All fields are required',
        };
      }
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });
      if (!user) {
        return { error: true, message: 'User does not exists' };
      }

      if (uploadLimit > user.uploadLimit) {
        user.availableLimit = user.availableLimit + (uploadLimit - user.uploadLimit);
      }

      if (uploadLimit < user.uploadLimit) {
        const temp = user.uploadLimit - uploadLimit;
        if (user.availableLimit > temp) {
          user.availableLimit = user.availableLimit - temp;
        }
      }

      user.uploadLimit = uploadLimit;
      await this.userRepository.save(user);
      return { error: false, message: 'User Updated' };

    } catch (error) {
      return { error: true, message: error?.message };
    }
  }

  async GetAllSheets(role: string, id: number) {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        return {
          error: true,
          message: 'User with this id not found.',
        };
      }
      const sheets = await this.phonebookRepository.find({
        relations: ['createdBy'],
        where: {
          createdBy: { id },
        },
      });
      return { error: false, sheets, message: 'sheets fetched.' };
    } catch (error) {
      return { error: true, message: error?.message };
    }
  }

  async GetAllUsers(role: string) {
    try {
      const users = await this.userRepository.find();
      return { error: false, users, message: 'users fetched.' };
    } catch (error) {
      return { error: true, message: error?.message };
    }
  }
  async downloadCsv(name: string, res) {
    try {
      const filePath = path.join(__dirname, '../../uploadedFiles', `${name}`);
      try {
      
   // Set the appropriate headers for file download
   res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
   res.setHeader('Content-Type', 'application/octet-stream');

   // Stream the file to the response
   const fileStream = fs.createReadStream(filePath);
   fileStream.pipe(res);        
      
      } catch (error) {
        // Log for debugging
        console.error('File does not exist:', error);

        // File does not exist
        return { error: true, message: 'This file does not exist' };
      }
    } catch (error) {
      return { error: true, message: error?.message };
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      // Find the user to be delete
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new Error('User not found');
      }

      await this.phonebookRepository.delete({ createdBy: user });
      await this.userRepository.remove(user);
    } catch (error) {
      throw new Error('Failed to delete user and associated phonebook entries');
    }
  }
}
