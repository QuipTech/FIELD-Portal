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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DOCUMENT_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { DocumentLifecycleService } from './documentLifecycle.service';
import { DocumentVersionsService } from './documentVersions.service';
import { RejectDocumentDto } from './dto/rejectDocumentDto';

// Indexing status and lifecycle actions for a document the caller can see
// (their organisation's or the shared library). Who may act is decided per
// document in documentAccess.ts: shared-library changes and reviews are
// Owner-only; an organisation's own documents need knowledge.submit.
@Controller('documents/:documentId')
@UseGuards(JwtAuthGuard)
export class DocumentLifecycleController {
  constructor(
    private readonly lifecycle: DocumentLifecycleService,
    private readonly versions: DocumentVersionsService,
  ) {}

  @Get('status')
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.getStatus(user, documentId);
  }

  // needs_review → live
  @Post('approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.transition(user, documentId, 'approve');
  }

  // needs_review → archived
  @Post('reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: RejectDocumentDto,
  ) {
    return this.lifecycle.transition(user, documentId, 'reject', dto.reason);
  }

  // failed → queued
  @Post('retry')
  @HttpCode(HttpStatus.OK)
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.transition(user, documentId, 'retry');
  }

  // live → archived (drops out of AI search)
  @Post('archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.transition(user, documentId, 'archive');
  }

  // multipart/form-data `file` (PDF/DOC/DOCX, ≤ 20 MB) → new version, queued.
  @Post('versions')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_RULE.maxBytes, files: 1 },
    }),
  )
  uploadVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.versions.uploadVersion(user, documentId, file);
  }

  // Permanent: all versions, their chunks and stored files.
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.lifecycle.deleteDocument(user, documentId);
  }
}
