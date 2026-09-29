import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AiUsageService } from './usage/aiUsage.service';
import { AiUsageQueryDto } from './dto/aiUsageQueryDto';

// AI configuration page — platform-wide usage and the read-only model
// setup. Owner only.
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminAiUsageController {
  constructor(private readonly aiUsageService: AiUsageService) {}

  @Get('usage')
  getUsage(@Query() query: AiUsageQueryDto) {
    return this.aiUsageService.getUsageOverview(query.days);
  }

  @Get('platform')
  getPlatform() {
    return this.aiUsageService.getPlatformInfo();
  }
}
