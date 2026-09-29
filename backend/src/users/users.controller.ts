import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AVATAR_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { AccountDeletionService } from './accountDeletion.service';
import { UserProfileService } from './userProfile.service';
import { UpdateProfileDto } from './dto/updateProfileDto';

// Only ever the caller's own account — the id comes from the JWT, never
// from the request, so one user can't change or delete another.
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly accountDeletionService: AccountDeletionService,
    private readonly userProfileService: UserProfileService,
  ) {}

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userProfileService.updateProfile(user, dto);
  }

  // multipart/form-data: `file` (JPG/PNG, ≤ 5 MB).
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_RULE.maxBytes, files: 1 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.userProfileService.uploadAvatar(user, file);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.accountDeletionService.deleteOwnAccount(
      user.userId,
      user.tenantId,
    );
  }
}
