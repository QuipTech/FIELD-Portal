import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminUsersModule } from './adminUsers/adminUsers.module';
import { AdminRolesModule } from './adminRoles/adminRoles.module';
import { AdminKnowledgeModule } from './adminKnowledge/adminKnowledge.module';
import { StorageModule } from './storage/storage.module';
import { KnowledgeIndexingModule } from './knowledgeIndexing/knowledgeIndexing.module';
import { DocumentsModule } from './documents/documents.module';
import { MachineHistoryModule } from './machineHistory/machineHistory.module';
import { MachineConfigurationModule } from './machineConfiguration/machineConfiguration.module';
import { KnowledgeSearchModule } from './knowledgeSearch/knowledgeSearch.module';
import { MachineLibraryModule } from './machineLibrary/machineLibrary.module';
import { AdminAiModule } from './adminAi/adminAi.module';
import { AiPlatformUsageModule } from './aiPlatformUsage/aiPlatformUsage.module';
import { AdminAuditLogModule } from './adminAuditLog/adminAuditLog.module';
import { AdminReportsModule } from './adminReports/adminReports.module';
import { AlertEngineModule } from './alertEngine/alertEngine.module';
import { AdminSubscriptionsModule } from './adminSubscriptions/adminSubscriptions.module';
import { OrganisationBrandingModule } from './organisationBranding/organisationBranding.module';
import { OrganisationNotificationsModule } from './organisationNotifications/organisationNotifications.module';
import { AdminDataRetentionModule } from './adminDataRetention/adminDataRetention.module';
import { BillingModule } from './billing/billing.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { MyDataModule } from './myData/myData.module';
import { OrganisationSubscriptionModule } from './organisationSubscription/organisationSubscription.module';
import { SupportCasesModule } from './supportCases/supportCases.module';
import { MachineFleetModule } from './machineFleet/machineFleet.module';
import { KnowledgeLibraryModule } from './knowledgeLibrary/knowledgeLibrary.module';
import { AiAssistantModule } from './aiAssistant/aiAssistant.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminOverviewModule } from './adminOverview/adminOverview.module';
import { DemoRequestsModule } from './demoRequests/demoRequests.module';
import { RequestSourceMiddleware } from './common/requestSource/requestSource.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    KnowledgeIndexingModule,
    AiPlatformUsageModule,
    AuthModule,
    AdminUsersModule,
    AdminRolesModule,
    AdminKnowledgeModule,
    DocumentsModule,
    MachineHistoryModule,
    MachineConfigurationModule,
    KnowledgeSearchModule,
    MachineLibraryModule,
    AdminAiModule,
    AdminAuditLogModule,
    AdminReportsModule,
    AlertEngineModule,
    AdminSubscriptionsModule,
    OrganisationBrandingModule,
    OrganisationNotificationsModule,
    AdminDataRetentionModule,
    BillingModule,
    EntitlementsModule,
    MyDataModule,
    OrganisationSubscriptionModule,
    SupportCasesModule,
    MachineFleetModule,
    KnowledgeLibraryModule,
    AiAssistantModule,
    DashboardModule,
    NotificationsModule,
    AdminOverviewModule,
    DemoRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestSourceMiddleware).forRoutes('*');
  }
}
