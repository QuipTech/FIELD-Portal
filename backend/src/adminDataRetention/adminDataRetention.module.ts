import { Module } from '@nestjs/common';
import { AdminDataRetentionController } from './adminDataRetention.controller';
import { DataRetentionService } from './dataRetention.service';
import { AiQueryLogPurgeJob } from './aiQueryLogPurge.job';

@Module({
  controllers: [AdminDataRetentionController],
  providers: [DataRetentionService, AiQueryLogPurgeJob],
})
export class AdminDataRetentionModule {}
