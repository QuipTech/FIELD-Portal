import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AdminKnowledgeUploadsService } from './adminKnowledgeUploads.service';
import { AdminKnowledgeService } from './adminKnowledge.service';
import { AdminKnowledgeVersionsService } from './adminKnowledgeVersions.service';
import { DocumentLifecycleService } from '../documents/documentLifecycle.service';
import { CreateVersionUploadDto } from './dto/createVersionUploadDto';
import { CreateKnowledgeUploadDto } from './dto/createKnowledgeUploadDto';
import { ListKnowledgeDocumentsQueryDto } from '../knowledge/dto/listKnowledgeDocumentsQueryDto';

// The admin Knowledge screen. The Owner manages the shared library and
// every organisation's documents. Uploading is two calls:
// POST /uploads (get a signed S3 URL), PUT the file to S3 from the
// browser, then POST /:id/upload-complete.
@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminKnowledgeController {
  constructor(
    private readonly adminKnowledgeService: AdminKnowledgeService,
    private readonly adminKnowledgeUploads: AdminKnowledgeUploadsService,
    private readonly adminKnowledgeVersions: AdminKnowledgeVersionsService,
    private readonly documentLifecycle: DocumentLifecycleService,
  ) {}

  @Get('documents')
  list(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: ListKnowledgeDocumentsQueryDto,
  ) {
    return this.adminKnowledgeService.listDocuments(scope, query);
  }

  @Post('uploads')
  createUpload(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateKnowledgeUploadDto,
  ) {
    return this.adminKnowledgeUploads.createUpload(actor, scope, dto);
  }

  @Post('documents/:documentId/upload-complete')
  @HttpCode(HttpStatus.OK)
  completeUpload(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.adminKnowledgeUploads.completeUpload(actor, scope, documentId);
  }

  // Large new version: returns a signed PUT like POST /uploads; finish
  // with POST /documents/:documentId/upload-complete.
  @Post('documents/:documentId/versions')
  createVersionUpload(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: CreateVersionUploadDto,
  ) {
    return this.adminKnowledgeVersions.createVersionUpload(
      actor,
      scope,
      documentId,
      dto,
    );
  }

  @Get('documents/:documentId/download')
  download(
    @CurrentAdminScope() scope: AdminScope,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.adminKnowledgeService.createDownloadUrl(scope, documentId);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  // The Owner may delete any document (checked by
  // DocumentLifecycleService, like the customer-side delete).
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documentLifecycle.deleteDocument(actor, documentId);
  }
}
