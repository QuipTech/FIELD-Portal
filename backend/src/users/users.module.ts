import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountDeletionService } from './accountDeletion.service';
import { CognitoUserDeletionService } from './cognitoUserDeletion.service';
import { CognitoUserDirectoryService } from './cognitoUserDirectory.service';
import { UserProfileService } from './userProfile.service';

@Module({
  imports: [BillingModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AccountDeletionService,
    CognitoUserDeletionService,
    CognitoUserDirectoryService,
    UserProfileService,
  ],
  exports: [
    UsersService,
    CognitoUserDirectoryService,
    CognitoUserDeletionService,
  ],
})
export class UsersModule {}
