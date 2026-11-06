import { Global, Module } from '@nestjs/common';
import { PushConfig } from './pushConfig';
import { PushDevicesService } from './pushDevices.service';
import { PushSenderService } from './pushSender.service';
import { SnsPushService } from './snsPush.service';

// Push through Amazon SNS. Global so account deletion and user removal can
// clean up a person's endpoints.
@Global()
@Module({
  providers: [
    PushConfig,
    SnsPushService,
    PushDevicesService,
    PushSenderService,
  ],
  exports: [PushDevicesService, PushSenderService],
})
export class PushModule {}
