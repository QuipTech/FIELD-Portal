import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageBucket } from './storageBucket';
import { SharedLibraryStorageService } from './sharedLibraryStorage.service';

// Global like DatabaseModule: documents, machine history, users and the
// knowledge library all store files through the one StorageService.
@Global()
@Module({
  providers: [StorageBucket, StorageService, SharedLibraryStorageService],
  exports: [StorageBucket, StorageService, SharedLibraryStorageService],
})
export class StorageModule {}
