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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { RequireActiveMachineGuard } from '../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { MACHINE_DOCUMENT_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import {
  ListMachineDocumentsQueryDto,
  UploadMachineDocumentDto,
} from './dto/machineDocumentDtos';
import { MachineDocumentsService } from './machineDocuments.service';

// A machine's documents: service reports, inspections, certificates, others.
@Controller('machines/:machineId/documents')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard, RequireActiveMachineGuard)
export class MachineDocumentsController {
  constructor(private readonly documents: MachineDocumentsService) {}

  @Get()
  @RequirePermissions('machine.view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: ListMachineDocumentsQueryDto,
  ) {
    return this.documents.listDocuments(user, machineId, query.type ?? null);
  }

  // multipart/form-data: `file` (PDF, Word, JPG, PNG, HEIC, ≤ 20 MB),
  // `documentType` and optional `historyEntryId`.
  @Post()
  @RequirePermissions('history.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MACHINE_DOCUMENT_RULE.maxBytes, files: 1 },
    }),
    IdempotencyInterceptor,
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() dto: UploadMachineDocumentDto,
  ) {
    return this.documents.uploadDocument(user, machineId, file, dto);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('machine.manage')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.deleteDocument(user, machineId, documentId);
  }
}
