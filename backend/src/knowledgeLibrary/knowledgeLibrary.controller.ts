import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeLibraryService } from './knowledgeLibrary.service';
import { SearchKnowledgeLibraryQueryDto } from './dto/searchKnowledgeLibraryQueryDto';

// The Knowledge screen's results: the organisation's own documents and the
// shared QuipTech library, like GET /documents (any signed-in user).
// Opening one uses GET /documents/:id/download.
@Controller('knowledge/library')
@UseGuards(JwtAuthGuard)
export class KnowledgeLibraryController {
  constructor(private readonly knowledgeLibrary: KnowledgeLibraryService) {}

  @Get()
  search(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SearchKnowledgeLibraryQueryDto,
  ) {
    return this.knowledgeLibrary.search(actor, query);
  }
}
