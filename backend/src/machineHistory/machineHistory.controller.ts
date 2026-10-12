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
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { PHOTO_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { MachineHistoryService } from './machineHistory.service';
import { MachinePhotosService } from './machinePhotos.service';
import { CreateHistoryEntryDto } from './dto/createHistoryEntryDto';
import { ListHistoryQueryDto } from './dto/listHistoryQueryDto';

// A machine's technical history and its photos, always within the
// caller's own organisation (tenantId from the JWT).
@Controller('machines/:machineId')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineHistoryController {
  constructor(
    private readonly machineHistoryService: MachineHistoryService,
    private readonly machinePhotosService: MachinePhotosService,
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
  @RequirePermissions('machine.view')
  listHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: ListHistoryQueryDto,
  ) {
    return this.machineHistoryService.listHistory(user, machineId, query);
  }

  // Everyone who has written on this machine's history (author filter).
  @Get('history/authors')
  @RequirePermissions('machine.view')
  listAuthors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.machineHistoryService.listAuthors(user, machineId);
  }

  @Post('history')
  @RequirePermissions('history.create')
  createEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: CreateHistoryEntryDto,
  ) {
    return this.machineHistoryService.createEntry(user, machineId, dto);
  }

  // multipart/form-data: `file` (JPG/PNG/HEIC, ≤ 10 MB).
  @Post('history/:entryId/photos')
  @RequirePermissions('history.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PHOTO_RULE.maxBytes, files: 1 },
    }),
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
