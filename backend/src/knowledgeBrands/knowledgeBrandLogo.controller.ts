import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { IncomingFile } from '../storage/types/storedFile';
import { LOGO_RULE } from '../storage/storageFileRules';
import { KnowledgeBrandLogoService } from './knowledgeBrandLogo.service';

@Controller('admin/knowledge/brands/:brandId/logo')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class KnowledgeBrandLogoController {
  constructor(private readonly logos: KnowledgeBrandLogoService) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LOGO_RULE.maxBytes, files: 1 },
    }),
  )
  upload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) id: string,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.logos.upload(actor, id, file);
  }
}
