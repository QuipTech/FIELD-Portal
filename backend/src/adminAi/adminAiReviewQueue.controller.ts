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
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AiReviewQueueService } from './reviewQueue/aiReviewQueue.service';
import { ListReviewQueueQueryDto } from './dto/listReviewQueueQueryDto';
import { UpdateReviewItemDto } from './dto/updateReviewItemDto';

// Conversations flagged for admin review, across every organisation.
// Owner only.
@Controller('admin/ai/reviewQueue')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminAiReviewQueueController {
  constructor(private readonly aiReviewQueueService: AiReviewQueueService) {}

  @Get()
  list(@Query() query: ListReviewQueueQueryDto) {
    return this.aiReviewQueueService.listItems(query);
  }

  // Declared before :itemId so "reviewers" isn't parsed as an id.
  @Get('reviewers')
  listReviewers() {
    return this.aiReviewQueueService.listReviewers();
  }

  @Get(':itemId')
  get(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.aiReviewQueueService.getItem(itemId);
  }

  @Patch(':itemId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateReviewItemDto,
  ) {
    return this.aiReviewQueueService.updateItem(actor, itemId, dto);
  }
}
