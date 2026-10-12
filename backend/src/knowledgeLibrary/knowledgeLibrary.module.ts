import { Module } from '@nestjs/common';
import { KnowledgeLibraryController } from './knowledgeLibrary.controller';
import { KnowledgeLibraryService } from './knowledgeLibrary.service';

@Module({
  controllers: [KnowledgeLibraryController],
  providers: [KnowledgeLibraryService],
})
export class KnowledgeLibraryModule {}
