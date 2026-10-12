import { Module } from '@nestjs/common';
import { SmsConfig } from './smsConfig';
import { SmsService } from './sms.service';

@Module({
  providers: [SmsConfig, SmsService],
  exports: [SmsService],
})
export class SmsModule {}
