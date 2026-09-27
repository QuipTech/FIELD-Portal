import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DOCUMENT_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { ListKnowledgeDocumentsQueryDto } from '../knowledge/dto/listKnowledgeDocumentsQueryDto';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/uploadDocumentDto';

// Documents for the caller's organisation (plus, when listing, the shared
// QuipTech library). Every route is authenticated and tenant-scoped via
// the JWT's tenantId.
@Controller('documents')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListKnowledgeDocumentsQueryDto,
  ) {
    return this.documentsService.listDocuments(user, query);
  }

  // multipart/form-data: `file` (PDF/DOC/DOCX, ≤ 20 MB), `type`, `title?`.
  @Post()
  @RequirePermissions('knowledge.submit')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_RULE.maxBytes, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(user, file, dto);
  }

  @Get(':documentId/download')
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documentsService.createDownloadUrl(user, documentId);
  }
}
