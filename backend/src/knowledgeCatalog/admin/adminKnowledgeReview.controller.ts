import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DocumentLifecycleService } from '../../documents/documentLifecycle.service';
import { KNOWLEDGE_ADMIN_PERMISSION } from '../access/knowledgeAccess';
import { ClassifyDocumentDto } from '../dto/knowledgeTaxonomyDtos';
import { KnowledgeAttentionService } from './knowledgeAttention.service';
import { KnowledgeTaxonomyService } from './knowledgeTaxonomy.service';

// The app's admin Knowledge actions (knowledge.publish). Who may change a
// given document is still decided per document (documents/documentAccess):
// approving needs platform.manage, as on the portal. A new version and
// deleting are the existing POST /documents/:id/versions and
// DELETE /documents/:id.
@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(KNOWLEDGE_ADMIN_PERMISSION)
export class AdminKnowledgeReviewController {
  constructor(
    private readonly attention: KnowledgeAttentionService,
    private readonly taxonomy: KnowledgeTaxonomyService,
    private readonly lifecycle: DocumentLifecycleService,
  ) {}

  @Get('attention')
  listAttention(@CurrentUser() actor: AuthenticatedUser) {
    return this.attention.list(actor);
  }

  // needs_review → live
  @Post('documents/:documentId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.transition(actor, documentId, 'approve');
  }

  // live → archived
  @Post('documents/:documentId/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.transition(actor, documentId, 'archive');
  }

  @Patch('documents/:documentId/classification')
  classify(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: ClassifyDocumentDto,
  ) {
    return this.taxonomy.classifyDocument(actor, documentId, dto);
  }
}
