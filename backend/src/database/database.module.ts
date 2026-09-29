import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ServiceDatabaseService } from './serviceDatabase.service';

@Global()
@Module({
  providers: [DatabaseService, ServiceDatabaseService],
  exports: [DatabaseService, ServiceDatabaseService],
})
export class DatabaseModule {}
