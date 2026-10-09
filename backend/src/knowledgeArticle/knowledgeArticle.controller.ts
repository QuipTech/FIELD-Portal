import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeArticleService } from './knowledgeArticle.service';

// The Knowledge article page (/knowledge/:id). 404 for documents outside
// the caller's organisation and the shared library; 409 { state, progress }
// while the document isn't live yet.
@Controller('documents/:documentId/article')
@UseGuards(JwtAuthGuard)
export class KnowledgeArticleController {
  constructor(
    private readonly knowledgeArticleService: KnowledgeArticleService,
  ) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.knowledgeArticleService.getArticle(user, documentId);
  }
}
