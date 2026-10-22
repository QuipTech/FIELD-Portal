import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DashboardService } from './dashboard.service';
import { AdminDashboardService } from './adminDashboard.service';

// The Dashboard screen. Any signed-in user: every figure is scoped to
// their own organisation, and AI threads to themselves.
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly adminDashboardService: AdminDashboardService,
  ) {}

  @Get()
  getSummary(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboardService.getSummary(actor);
  }

  // Admins only (403 otherwise): machines down, cases near SLA breach, AI
  // answers to review, bulletins to approve.
  @Get('admin')
  getAdminDashboard(@CurrentUser() actor: AuthenticatedUser) {
    return this.adminDashboardService.getAdminDashboard(actor);
  }
}
