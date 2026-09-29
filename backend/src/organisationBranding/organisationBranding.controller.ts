import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { LOGO_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/updateBrandingDto';

// The signed-in user's own organisation's branding. Anyone in the
// organisation can read it (the app themes itself from it); only its
// Owners can change it. There's no organisation id in the path — it's
// always the caller's.
@Controller('organisation/branding')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
export class OrganisationBrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  get(@CurrentUser() actor: AuthenticatedUser) {
    return this.brandingService.getBranding(actor);
  }

  @Put()
  @RequireRoles(OWNER_ROLE_NAME)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.brandingService.updateBranding(actor, dto);
  }

  // multipart/form-data: `file` (PNG, JPG or script-free SVG, ≤ 2 MB).
  @Post('logo')
  @RequireRoles(OWNER_ROLE_NAME)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LOGO_RULE.maxBytes, files: 1 },
    }),
  )
  uploadLogo(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.brandingService.uploadLogo(actor, file);
  }

  @Delete('logo')
  @RequireRoles(OWNER_ROLE_NAME)
  removeLogo(@CurrentUser() actor: AuthenticatedUser) {
    return this.brandingService.removeLogo(actor);
  }
}
