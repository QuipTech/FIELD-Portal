import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../email/email.module';
import { DashboardConfig } from '../dashboard/dashboardConfig';
import { SupportCasesController } from './supportCases.controller';
import { AdminSupportCasesController } from './adminSupportCases.controller';
import { SupportCasesService } from './supportCases.service';
import { CaseMessagesService } from './caseMessages.service';
import { AdminSupportCasesService } from './adminSupportCases.service';
import { AdminCaseUpdatesService } from './adminCaseUpdates.service';
import { CaseAccessService } from './caseAccess.service';
import { CaseAttachmentsService } from './caseAttachments.service';
import { CaseAnnouncer } from './caseAnnouncer.service';
import { CaseEmailNotifier } from './caseEmailNotifier.service';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { CaseSocketAuthenticator } from './caseSocketAuthenticator';
import { CaseRealtimeGateway } from './caseRealtime.gateway';
import { CaseAutoCloseWorker } from './caseAutoClose.worker';
import { SupportStaffGuard } from './supportStaff.guard';

// DashboardConfig: the same SLA targets the dashboard reports against.
@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [SupportCasesController, AdminSupportCasesController],
  providers: [
    DashboardConfig,
    SupportCasesService,
    CaseMessagesService,
    AdminSupportCasesService,
    AdminCaseUpdatesService,
    CaseAccessService,
    CaseAttachmentsService,
    CaseAnnouncer,
    CaseEmailNotifier,
    CaseEventsPublisher,
    CaseSocketAuthenticator,
    CaseRealtimeGateway,
    CaseAutoCloseWorker,
    SupportStaffGuard,
  ],
})
export class SupportCasesModule {}
