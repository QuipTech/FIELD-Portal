import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountDeletionService } from './accountDeletion.service';
import { CognitoUserDeletionService } from './cognitoUserDeletion.service';
import { CognitoUserDirectoryService } from './cognitoUserDirectory.service';
import { UserProfileService } from './userProfile.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    AccountDeletionService,
    CognitoUserDeletionService,
    CognitoUserDirectoryService,
    UserProfileService,
  ],
  exports: [UsersService, CognitoUserDirectoryService],
})
export class UsersModule {}
