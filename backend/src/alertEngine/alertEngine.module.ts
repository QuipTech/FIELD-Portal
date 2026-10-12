import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { AlertEngineService } from './alertEngine.service';
import { AlertScheduleService } from './alertSchedule.service';
import { AlertDispatcherService } from './alertDispatcher.service';
import { EmailChannel } from './channels/emailChannel';
import { SmsChannel } from './channels/smsChannel';
import { PushChannel } from './channels/pushChannel';

// Needs ScheduleModule.forRoot() in AppModule for the cron jobs.
@Module({
  imports: [EmailModule, SmsModule],
  providers: [
    AlertEngineService,
    AlertScheduleService,
    AlertDispatcherService,
    EmailChannel,
    SmsChannel,
    PushChannel,
  ],
  exports: [AlertEngineService],
})
export class AlertEngineModule {}
