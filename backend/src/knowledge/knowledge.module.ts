import { Module } from '@nestjs/common';
import { DocumentPageCountService } from './documentPageCount.service';

// Knowledge-document pieces shared by the admin library and organisation
// documents: the list query/mapper (plain functions) and page counting.
@Module({
  providers: [DocumentPageCountService],
  exports: [DocumentPageCountService],
})
export class KnowledgeModule {}
