import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AdminOverviewService } from './adminOverview.service';

// The admin portal's Overview page, for the caller's AdminScope (every
// organisation for the Owner).
@Controller('admin/overview')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminOverviewController {
  constructor(private readonly adminOverviewService: AdminOverviewService) {}

  @Get()
  getOverview(@CurrentAdminScope() scope: AdminScope) {
    return this.adminOverviewService.getOverview(scope);
  }
}
