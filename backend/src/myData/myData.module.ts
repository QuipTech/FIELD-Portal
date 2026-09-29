import { Module } from '@nestjs/common';
import { MyDataController } from './myData.controller';
import { MyDataExportService } from './myDataExport.service';
import { AccountDeletionRequestService } from './accountDeletionRequest.service';
import { DataExportWorker } from './dataExport.worker';

@Module({
  controllers: [MyDataController],
  providers: [
    MyDataExportService,
    AccountDeletionRequestService,
    DataExportWorker,
  ],
})
export class MyDataModule {}
