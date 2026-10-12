import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { PHOTO_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { MachineGalleryService } from './machineGallery.service';
import { UploadGalleryPhotoDto } from './dto/uploadGalleryPhotoDto';

// The photo gallery on a machine's detail screen.
@Controller('machines/:machineId/photos')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineGalleryController {
  constructor(private readonly machineGalleryService: MachineGalleryService) {}

  @Get()
  @RequirePermissions('machine.view')
  listPhotos(@CurrentUser() user: AuthenticatedUser, @Param('machineId', ParseUUIDPipe) machineId: string) {
    return this.machineGalleryService.listPhotos(user, machineId);
  }

  // multipart/form-data: `file` (JPG/PNG/HEIC, ≤ 10 MB) and optional `caption`.
  @Post()
  @RequirePermissions('machine.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PHOTO_RULE.maxBytes, files: 1 } }))
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() dto: UploadGalleryPhotoDto,
  ) {
    return this.machineGalleryService.uploadPhoto(user, machineId, file, dto.caption);
  }
}
