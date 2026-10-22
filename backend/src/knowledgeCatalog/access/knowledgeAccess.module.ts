import { Module } from '@nestjs/common';
import { KnowledgeAccessService } from './knowledgeAccess.service';

// The caller's Knowledge access (admin? platform admin?), shared by the
// catalogue and AI retrieval so both apply the same brand rule.
@Module({
  providers: [KnowledgeAccessService],
  exports: [KnowledgeAccessService],
})
export class KnowledgeAccessModule {}
