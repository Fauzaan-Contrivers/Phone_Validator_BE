import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { Users } from '../auth/users.entity';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendResetPasswordEmail(user: Users, jwtTokwn: string) {
    const url = `${process.env.APP_URL}/forget-password/${jwtTokwn}`;
    await this.mailerService
      .sendMail({
        to: user.email,
        subject: 'Reset your password',
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
