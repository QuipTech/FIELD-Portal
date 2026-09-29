import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { SubscriptionsService } from './subscriptions.service';
import { ListSubscriptionsQueryDto } from './dto/listSubscriptionsQueryDto';
import { UpsertSubscriptionDto } from './dto/upsertSubscriptionDto';

// Every organisation's subscription — Owner only. Organisations are
// addressed by tenant id; each has at most one subscription.
@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  list(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.listSubscriptions(query);
  }

  @Get(':tenantId')
  get(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.subscriptionsService.getSubscription(tenantId);
  }

  // Sets up or replaces the whole subscription.
  @Put(':tenantId')
  upsert(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpsertSubscriptionDto,
  ) {
    return this.subscriptionsService.upsertSubscription(actor, tenantId, dto);
  }
}
