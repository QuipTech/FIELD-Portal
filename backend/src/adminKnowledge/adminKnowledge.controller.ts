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
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AdminKnowledgeService } from './adminKnowledge.service';
import { AdminKnowledgeVersionsService } from './adminKnowledgeVersions.service';
import { DocumentLifecycleService } from '../documents/documentLifecycle.service';
import { CreateVersionUploadDto } from './dto/createVersionUploadDto';
import { CreateKnowledgeUploadDto } from './dto/createKnowledgeUploadDto';
import { ListKnowledgeDocumentsQueryDto } from '../knowledge/dto/listKnowledgeDocumentsQueryDto';

// The shared knowledge library every organisation reads — Owner only.
// Uploading is two calls: POST /uploads (get a signed S3 URL), PUT the
// file to S3 from the browser, then POST /:id/upload-complete.
@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminKnowledgeController {
  constructor(
    private readonly adminKnowledgeService: AdminKnowledgeService,
    private readonly adminKnowledgeVersions: AdminKnowledgeVersionsService,
    private readonly documentLifecycle: DocumentLifecycleService,
  ) {}

  @Get('documents')
  list(@Query() query: ListKnowledgeDocumentsQueryDto) {
    return this.adminKnowledgeService.listDocuments(query);
  }

  @Post('uploads')
  createUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateKnowledgeUploadDto,
  ) {
    return this.adminKnowledgeService.createUpload(actor, dto);
  }

  @Post('documents/:documentId/upload-complete')
  @HttpCode(HttpStatus.OK)
  completeUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.adminKnowledgeService.completeUpload(actor, documentId);
  }

  // Large new version: returns a signed PUT like POST /uploads; finish
  // with POST /documents/:documentId/upload-complete.
  @Post('documents/:documentId/versions')
  createVersionUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: CreateVersionUploadDto,
  ) {
    return this.adminKnowledgeVersions.createVersionUpload(
      actor,
      documentId,
      dto,
    );
  }

  @Get('documents/:documentId/download')
  download(@Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.adminKnowledgeService.createDownloadUrl(documentId);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documentLifecycle.deleteDocument(actor, documentId);
  }
}
