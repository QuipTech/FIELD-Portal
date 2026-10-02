import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AiUsageService } from './usage/aiUsage.service';
import { AiUsageQueryDto } from './dto/aiUsageQueryDto';

// AI configuration page — usage for the caller's AdminScope (every
// organisation for the Owner) and the read-only model setup.
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminAiUsageController {
  constructor(private readonly aiUsageService: AiUsageService) {}

  @Get('usage')
  getUsage(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: AiUsageQueryDto,
  ) {
    return this.aiUsageService.getUsageOverview(scope, query.days);
  }

  @Get('platform')
  getPlatform() {
    return this.aiUsageService.getPlatformInfo();
  }
}
