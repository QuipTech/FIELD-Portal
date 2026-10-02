import { Module } from '@nestjs/common';
import { BedrockConfig } from './bedrockConfig';
import { BedrockService } from './bedrock.service';

// Claude on Amazon Bedrock. Knows nothing about tenants, retrieval or the
// database: callers pass everything a request needs.
@Module({
  providers: [BedrockConfig, BedrockService],
  exports: [BedrockService],
})
export class BedrockModule {}
