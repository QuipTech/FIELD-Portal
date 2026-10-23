import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { PlanOptionsService } from './planOptions.service';

// The plans and add-ons on offer with today's list prices, for the app's
// Subscription screen (the current plan is GET /organisation/subscription).
@Controller('organisation/subscription/options')
@UseGuards(JwtAuthGuard)
export class PlanOptionsController {
  constructor(private readonly planOptions: PlanOptionsService) {}

  @Get()
  list() {
    return this.planOptions.listOptions();
  }
}
