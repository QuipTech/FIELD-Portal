import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PublicDemoRequestsController } from './publicDemoRequests.controller';
import { AdminDemoRequestsController } from './adminDemoRequests.controller';
import { DemoRequestsService } from './demoRequests.service';
import { DemoRequestEmailsService } from './demoRequestEmails.service';
import { DemoRequestsConfig } from './demoRequestsConfig';

// Its rate limit is registered in AppModule (ThrottlerModule is global)
// and applied only on the public controller's ThrottlerGuard.
@Module({
  imports: [EmailModule],
  controllers: [PublicDemoRequestsController, AdminDemoRequestsController],
  providers: [
    DemoRequestsConfig,
    DemoRequestsService,
    DemoRequestEmailsService,
  ],
})
export class DemoRequestsModule {}
