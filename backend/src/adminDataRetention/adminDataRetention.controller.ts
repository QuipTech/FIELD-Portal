import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { DataRetentionService } from './dataRetention.service';
import { UpdateDataRetentionDto } from './dto/updateDataRetentionDto';

// Admin → Settings → Data & retention for the caller's own organisation —
// Owner only.
@Controller('admin/settings/data-retention')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminDataRetentionController {
  constructor(private readonly dataRetentionService: DataRetentionService) {}

  @Get()
  get(@CurrentUser() actor: AuthenticatedUser) {
    return this.dataRetentionService.getSettings(actor);
  }

  // Only aiQueryLogsMonths can change; written to the audit log.
  @Patch()
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateDataRetentionDto,
  ) {
    return this.dataRetentionService.updateSettings(actor, dto);
  }
}
