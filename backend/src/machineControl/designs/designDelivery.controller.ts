import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { IncomingFile } from '../../storage/types/storedFile';
import { MC_PERMISSIONS } from '../access/machineControlAccess';
import { RequireMachineControlGuard } from '../access/requireMachineControl.guard';
import { PairedDevice } from '../session/deviceSession.service';
import {
  CurrentDevice,
  CurrentDeviceToken,
  DeviceTokenGuard,
} from '../session/deviceToken.guard';
import {
  MAX_DESIGN_FILES,
  MAX_DESIGN_FILE_BYTES,
  PreviewDesignDelivery,
  SendDesignDelivery,
  UpdateDesignDelivery,
  UploadDesignVersion,
} from './designDelivery.types';
import { DesignLibraryService } from './designLibrary.service';
import { DeviceDesignDeliveryService } from './deviceDesignDelivery.service';

@Controller('mc/designs')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard, RequireMachineControlGuard)
export class DesignLibraryController {
  constructor(private readonly library: DesignLibraryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(MC_PERMISSIONS.view)
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.library.list(actor);
  }

  @Get('targets')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(MC_PERMISSIONS.deliver)
  targets(@CurrentUser() actor: AuthenticatedUser) {
    return this.library.targets(actor);
  }

  @Get('versions/:id/files/:index')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(MC_PERMISSIONS.view)
  download(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.library.download(actor, id, index);
  }

  @Post('versions')
  @RequirePermissions(MC_PERMISSIONS.upload)
  @UseInterceptors(
    FilesInterceptor('files', MAX_DESIGN_FILES, {
      limits: {
        fileSize: MAX_DESIGN_FILE_BYTES + 1,
        fields: 2,
        fieldSize: 48_000,
      },
    }),
  )
  upload(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UploadDesignVersion,
    @UploadedFiles() files: IncomingFile[],
  ) {
    return this.library.upload(actor, dto, files ?? []);
  }

  @Post('preview')
  @RequirePermissions(MC_PERMISSIONS.deliver)
  preview(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PreviewDesignDelivery,
  ) {
    return this.library.preview(actor, dto);
  }

  @Post('deliveries')
  @RequirePermissions(MC_PERMISSIONS.deliver)
  send(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SendDesignDelivery,
  ) {
    return this.library.send(actor, dto);
  }
}

@Controller('mc/device/designs')
@UseGuards(DeviceTokenGuard)
export class DeviceDesignDeliveryController {
  constructor(private readonly deliveries: DeviceDesignDeliveryService) {}

  @Get('next')
  @Header('Cache-Control', 'no-store')
  next(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
  ) {
    return this.deliveries.next(device, token);
  }

  @Get(':id/files/:index')
  @Header('Cache-Control', 'no-store')
  download(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.deliveries.download(device, token, id, index);
  }

  @Patch(':id')
  update(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignDelivery,
  ) {
    return this.deliveries.update(device, token, id, dto);
  }
}
