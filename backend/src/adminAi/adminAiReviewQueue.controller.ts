import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AiReviewQueueService } from './reviewQueue/aiReviewQueue.service';
import { ListReviewQueueQueryDto } from './dto/listReviewQueueQueryDto';
import { UpdateReviewItemDto } from './dto/updateReviewItemDto';

// Answers flagged for review, for the caller's AdminScope (every
// organisation for the Owner).
@Controller('admin/ai/reviewQueue')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminAiReviewQueueController {
  constructor(private readonly aiReviewQueueService: AiReviewQueueService) {}

  @Get()
  list(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: ListReviewQueueQueryDto,
  ) {
    return this.aiReviewQueueService.listItems(scope, query);
  }

  // Declared before :itemId so "reviewers" isn't parsed as an id.
  @Get('reviewers')
  listReviewers(@CurrentAdminScope() scope: AdminScope) {
    return this.aiReviewQueueService.listReviewers(scope);
  }

  @Get(':itemId')
  get(
    @CurrentAdminScope() scope: AdminScope,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.aiReviewQueueService.getItem(scope, itemId);
  }

  @Patch(':itemId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentAdminScope() scope: AdminScope,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateReviewItemDto,
  ) {
    return this.aiReviewQueueService.updateItem(actor, scope, itemId, dto);
  }
}
