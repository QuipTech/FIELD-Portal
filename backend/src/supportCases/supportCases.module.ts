import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SupportCasesController } from './supportCases.controller';
import { SupportCasesService } from './supportCases.service';
import { CaseMessagesService } from './caseMessages.service';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { CaseSocketAuthenticator } from './caseSocketAuthenticator';
import { CaseRealtimeGateway } from './caseRealtime.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SupportCasesController],
  providers: [
    SupportCasesService,
    CaseMessagesService,
    CaseEventsPublisher,
    CaseSocketAuthenticator,
    CaseRealtimeGateway,
  ],
})
export class SupportCasesModule {}
