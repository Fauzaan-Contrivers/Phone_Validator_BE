import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from '../auth/user.entity';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) { }

  async sendPasswordResetEmail(user: User, jwtTokwn: string, subject: string) {
    const url = `${process.env.APP_URL}/forget-password/${jwtTokwn}`;
    await this.mailerService
      .sendMail({
        to: user.email,
        subject: subject,
        template: './invite',
        context: {
          name: user.name,
          url,
        },
      })
      .catch((e) => {
        console.log(e);
      });
  }
}
