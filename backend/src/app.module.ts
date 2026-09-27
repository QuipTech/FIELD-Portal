import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminUsersModule } from './adminUsers/adminUsers.module';
import { AdminRolesModule } from './adminRoles/adminRoles.module';
import { AdminKnowledgeModule } from './adminKnowledge/adminKnowledge.module';
import { StorageModule } from './storage/storage.module';
import { KnowledgeIndexingModule } from './knowledgeIndexing/knowledgeIndexing.module';
import { DocumentsModule } from './documents/documents.module';
import { MachineHistoryModule } from './machineHistory/machineHistory.module';
import { KnowledgeSearchModule } from './knowledgeSearch/knowledgeSearch.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),
    DatabaseModule,
    StorageModule,
    KnowledgeIndexingModule,
    AuthModule,
    AdminUsersModule,
    AdminRolesModule,
    AdminKnowledgeModule,
    DocumentsModule,
    MachineHistoryModule,
    KnowledgeSearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
