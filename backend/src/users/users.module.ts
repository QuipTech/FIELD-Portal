import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountDeletionService } from './accountDeletion.service';
import { CognitoUserDeletionService } from './cognitoUserDeletion.service';
import { UserProfileService } from './userProfile.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    AccountDeletionService,
    CognitoUserDeletionService,
    UserProfileService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
