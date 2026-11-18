import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  MACHINE_DOCUMENT_TYPES,
  MachineDocumentType,
} from '../../machineHistory/dto/machineDocumentDtos';
import { MACHINE_DOCUMENT_RULE } from '../../storage/storageFileRules';
import { IncomingFile } from '../../storage/types/storedFile';
import { PairedDevice } from '../session/deviceSession.service';
import {
  CurrentDevice,
  CurrentDeviceToken,
  DeviceTokenGuard,
} from '../session/deviceToken.guard';
import { DeviceFileTransferService } from './deviceFileTransfer.service';

class DeviceFileTransferDto {
  @IsUUID()
  transferId!: string;

  @IsOptional()
  @IsIn(MACHINE_DOCUMENT_TYPES)
  documentType?: MachineDocumentType;
}

@Controller('mc/device/files')
@UseGuards(DeviceTokenGuard)
export class DeviceFileTransferController {
  constructor(private readonly transfers: DeviceFileTransferService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MACHINE_DOCUMENT_RULE.maxBytes, files: 1, fields: 2 },
    }),
  )
  upload(
    @CurrentDevice() device: PairedDevice,
    @CurrentDeviceToken() token: string,
    @UploadedFile() file: IncomingFile | undefined,
    @Body() dto: DeviceFileTransferDto,
  ) {
    return this.transfers.upload(
      device,
      token,
      file,
      dto.transferId,
      dto.documentType ?? 'other',
    );
  }
}
