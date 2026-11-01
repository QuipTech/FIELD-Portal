import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationListenerService } from './notificationListener.service';
import { NotificationSettingsController } from './notificationSettings.controller';
import { NotificationSettingsService } from './notificationSettings.service';
import { PushModule } from './push/push.module';

@Module({
  imports: [JwtModule.register({}), PushModule],
  controllers: [NotificationsController, NotificationSettingsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationListenerService,
    NotificationSettingsService,
  ],
})
export class NotificationsModule {}
