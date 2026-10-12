import { Module } from '@nestjs/common';
import { OrganisationNotificationsController } from './organisationNotifications.controller';
import { NotificationSettingsService } from './notificationSettings.service';
import { AlertRulesService } from './alertRules.service';
import { AlertEngineModule } from '../alertEngine/alertEngine.module';

@Module({
  imports: [AlertEngineModule],
  controllers: [OrganisationNotificationsController],
  providers: [NotificationSettingsService, AlertRulesService],
})
export class OrganisationNotificationsModule {}
