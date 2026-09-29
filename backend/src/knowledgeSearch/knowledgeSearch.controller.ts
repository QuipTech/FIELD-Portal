import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeSearchService } from './knowledgeSearch.service';
import { SearchKnowledgeDto } from './dto/searchKnowledgeDto';

// Semantic search over live knowledge — what the AI assistant retrieves
// its sources from. Tenant-scoped: own organisation + shared library.
@Controller('knowledge')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class KnowledgeSearchController {
  constructor(private readonly knowledgeSearch: KnowledgeSearchService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ai.use')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchKnowledgeDto,
  ) {
    return this.knowledgeSearch.search(user, dto.query, dto.limit);
  }
}
