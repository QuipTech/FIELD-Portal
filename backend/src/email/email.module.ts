import { Module } from '@nestjs/common';
import { EmailConfig } from './emailConfig';
import { EmailService } from './email.service';

@Module({
  providers: [EmailConfig, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
