import { Global, Module } from '@nestjs/common';
import { AiPlatformUsageService } from './aiPlatformUsage.service';

// Global so the indexing worker, knowledge search and the prompt Test
// button can all record usage without import chains.
@Global()
@Module({
  providers: [AiPlatformUsageService],
  exports: [AiPlatformUsageService],
})
export class AiPlatformUsageModule {}
