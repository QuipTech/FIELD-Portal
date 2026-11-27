import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  Get,
  Header,
  HttpException,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { RequireActiveMachineGuard } from '../../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { IncomingFile } from '../../storage/types/storedFile';
import { MC_PERMISSIONS } from '../access/machineControlAccess';
import { RequireMachineControlGuard } from '../access/requireMachineControl.guard';
import { MAX_DESIGN_FILE_BYTES, MAX_DESIGN_FILES } from './designDelivery.types';
import { tabletFileErrors, TabletFilesService } from './tabletFiles.service';
import { SendTabletFiles } from './tabletFiles.types';

// The upload parser rejects an oversized file or a 33rd one before the
// service runs; give those the same codes.
@Catch(PayloadTooLargeException, BadRequestException)
export class TabletUploadLimitFilter extends BaseExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    super.catch(
      exception.message === 'File too large'
        ? tabletFileErrors.fileTooLarge()
        : exception.message === 'Too many files'
          ? tabletFileErrors.tooMany()
          : exception,
      host,
    );
  }
}

// "Send to tablet" on one machine (the remote session window and the
// Machine app tab).
@Controller('machines/:machineId/tablet-files')
@UseGuards(
  JwtAuthGuard,
  RequirePermissionsGuard,
  RequireMachineControlGuard,
  RequireActiveMachineGuard,
)
export class TabletFilesController {
  constructor(private readonly tabletFiles: TabletFilesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(MC_PERMISSIONS.view)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.tabletFiles.list(actor, machineId);
  }

  // multipart/form-data: "sendId", "names" and one "files" part per file.
  @Post()
  @RequirePermissions(MC_PERMISSIONS.deliver)
  @UseFilters(TabletUploadLimitFilter)
  @UseInterceptors(
    FilesInterceptor('files', MAX_DESIGN_FILES, {
      limits: {
        fileSize: MAX_DESIGN_FILE_BYTES + 1,
        files: MAX_DESIGN_FILES,
        fields: 2,
        fieldSize: 48_000,
      },
    }),
  )
  send(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: SendTabletFiles,
    @UploadedFiles() files: IncomingFile[],
  ) {
    return this.tabletFiles.send(actor, machineId, dto, files ?? []);
  }
}
