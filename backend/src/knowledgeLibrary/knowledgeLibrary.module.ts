import { Module } from '@nestjs/common';
import { KnowledgeLibraryController } from './knowledgeLibrary.controller';
import { KnowledgeLibraryService } from './knowledgeLibrary.service';

@Module({
  controllers: [KnowledgeLibraryController],
  exports: [KnowledgeLibraryService],
  providers: [KnowledgeLibraryService],
})
export class KnowledgeLibraryModule {}
