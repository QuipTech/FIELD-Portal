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
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { SubscriptionsService } from './subscriptions.service';
import { ListSubscriptionsQueryDto } from './dto/listSubscriptionsQueryDto';
import { UpsertSubscriptionDto } from './dto/upsertSubscriptionDto';

// Subscriptions: the Owner sees and sets every organisation's. Organisations are addressed by tenant id;
// each has at most one subscription.
@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  list(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: ListSubscriptionsQueryDto,
  ) {
    return this.subscriptionsService.listSubscriptions(scope, query);
  }

  @Get(':tenantId')
  get(
    @CurrentAdminScope() scope: AdminScope,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.subscriptionsService.getSubscription(scope, tenantId);
  }

  // Sets up or replaces the whole subscription. Owner only.
  @Put(':tenantId')
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions(PLATFORM_PERMISSION_CODE)
  upsert(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentAdminScope() scope: AdminScope,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: UpsertSubscriptionDto,
  ) {
    return this.subscriptionsService.upsertSubscription(
      actor,
      scope,
      tenantId,
      dto,
    );
  }
}
