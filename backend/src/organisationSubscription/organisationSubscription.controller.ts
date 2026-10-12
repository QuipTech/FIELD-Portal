import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OrganisationSubscriptionService } from './organisationSubscription.service';

// Profile & settings → Subscription: the caller's organisation plan, or the
// free plan when it has none (or it lapsed).
@Controller('organisation/subscription')
@UseGuards(JwtAuthGuard)
export class OrganisationSubscriptionController {
  constructor(
    private readonly organisationSubscriptionService: OrganisationSubscriptionService,
  ) {}

  @Get()
  get(@CurrentUser() actor: AuthenticatedUser) {
    return this.organisationSubscriptionService.getSubscription(actor.tenantId);
  }
}
