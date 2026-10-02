import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DashboardService } from './dashboard.service';

// The Dashboard screen. Any signed-in user: every figure is scoped to
// their own organisation, and AI threads to themselves.
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getSummary(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboardService.getSummary(actor);
  }
}
