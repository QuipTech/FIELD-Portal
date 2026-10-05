import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EmailModule } from '../email/email.module';
import { PublicDemoRequestsController } from './publicDemoRequests.controller';
import { AdminDemoRequestsController } from './adminDemoRequests.controller';
import { DemoRequestsService } from './demoRequests.service';
import { DemoRequestEmailsService } from './demoRequestEmails.service';
import { TurnstileVerifierService } from './turnstileVerifier.service';
import { DemoRequestsConfig } from './demoRequestsConfig';
import { DEMO_REQUEST_THROTTLER } from './demoRequestsThrottle';

// ThrottlerGuard is applied only on the public controller (not as a
// global guard), so no other route is rate limited by this.
@Module({
  imports: [EmailModule, ThrottlerModule.forRoot([DEMO_REQUEST_THROTTLER])],
  controllers: [PublicDemoRequestsController, AdminDemoRequestsController],
  providers: [
    DemoRequestsConfig,
    DemoRequestsService,
    DemoRequestEmailsService,
    TurnstileVerifierService,
  ],
})
export class DemoRequestsModule {}
