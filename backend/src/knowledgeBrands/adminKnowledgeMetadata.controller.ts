import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeMetadataService } from '../knowledge/knowledgeMetadata.service';
import { UpdateKnowledgeDocumentDto } from './dto/updateKnowledgeDocumentDto';

@Controller('admin/knowledge/documents')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminKnowledgeMetadataController {
  constructor(private readonly metadata: KnowledgeMetadataService) {}
  @Patch(':id') update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
  ) {
    return this.metadata.update(actor, id, dto);
  }
}
