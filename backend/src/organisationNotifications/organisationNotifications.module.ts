import { Module } from '@nestjs/common';
import { OrganisationNotificationsController } from './organisationNotifications.controller';
import { NotificationSettingsService } from './notificationSettings.service';
import { AlertRulesService } from './alertRules.service';

@Module({
  controllers: [OrganisationNotificationsController],
  providers: [NotificationSettingsService, AlertRulesService],
})
export class OrganisationNotificationsModule {}
