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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { PHOTO_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { RequireActiveMachineGuard } from '../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { MachineHistoryService } from './machineHistory.service';
import { MachinePhotosService } from './machinePhotos.service';
import { HistoryExportService } from './historyExport.service';
import { CreateHistoryEntryDto } from './dto/createHistoryEntryDto';
import { ListHistoryQueryDto } from './dto/listHistoryQueryDto';
import { ExportHistoryQueryDto } from './dto/exportHistoryQueryDto';

// A machine's technical history and its photos, always within the
// caller's own organisation (tenantId from the JWT).
@Controller('machines/:machineId')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineHistoryController {
  constructor(
    private readonly machineHistoryService: MachineHistoryService,
    private readonly machinePhotosService: MachinePhotosService,
    private readonly historyExportService: HistoryExportService,
  ) {}

  @Get()
  @RequirePermissions('machine.view')
  getMachine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.machineHistoryService.getMachine(user, machineId);
  }

  @Get('history')
  @UseGuards(RequireActiveMachineGuard)
  @RequirePermissions('machine.view')
  listHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: ListHistoryQueryDto,
  ) {
    return this.machineHistoryService.listHistory(user, machineId, query);
  }

  // ?format=csv|pdf plus the list's filters; the whole matching history.
  @Get('history/export')
  @UseGuards(RequireActiveMachineGuard)
  @RequirePermissions('machine.view')
  async exportHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: ExportHistoryQueryDto,
    @Res() response: Response,
  ) {
    const file = await this.historyExportService.exportHistory(user, machineId, query);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    response.send(typeof file.body === 'string' ? file.body : Buffer.from(file.body));
  }

  // Everyone who has written on this machine's history (author filter).
  @Get('history/authors')
  @UseGuards(RequireActiveMachineGuard)
  @RequirePermissions('machine.view')
  listAuthors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.machineHistoryService.listAuthors(user, machineId);
  }

  // Idempotency-Key makes an entry queued offline safe to resend.
  @Post('history')
  @UseGuards(RequireActiveMachineGuard)
  @RequirePermissions('history.create')
  @UseInterceptors(IdempotencyInterceptor)
  createEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: CreateHistoryEntryDto,
  ) {
    return this.machineHistoryService.createEntry(user, machineId, dto);
  }

  // multipart/form-data: `file` (JPG/PNG/HEIC, ≤ 10 MB).
  @Post('history/:entryId/photos')
  @UseGuards(RequireActiveMachineGuard)
  @RequirePermissions('history.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PHOTO_RULE.maxBytes, files: 1 },
    }),
    IdempotencyInterceptor,
  )
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.machinePhotosService.uploadPhoto(
      user,
      { machineId, entryId },
      file,
    );
  }

  @Delete('history/:entryId/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RequireActiveMachineGuard)
  @RequirePermissions('history.delete_photos')
  deletePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.machinePhotosService.deletePhoto(user, {
      machineId,
      entryId,
      photoId,
    });
  }
}
