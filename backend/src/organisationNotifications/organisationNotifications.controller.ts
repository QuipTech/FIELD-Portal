import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { NotificationSettingsService } from './notificationSettings.service';
import { AlertRulesService } from './alertRules.service';
import { AlertRuleDto, SetAlertRuleEnabledDto } from './dto/alertRuleDto';
import { UpdateChannelsDto } from './dto/updateChannelsDto';

// Settings → Notifications & alerts for the signed-in user's own
// organisation — Owner only. Stores configuration; nothing is sent yet.
@Controller('organisation/notifications')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class OrganisationNotificationsController {
  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
    private readonly alertRulesService: AlertRulesService,
  ) {}

  // Rules and channel switches; creates the defaults on first visit.
  @Get()
  getSettings(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationSettingsService.getSettings(actor);
  }

  // Trigger types (with their settings), audiences and channels.
  @Get('options')
  getOptions() {
    return this.notificationSettingsService.getOptions();
  }

  @Patch('channels')
  updateChannels(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateChannelsDto,
  ) {
    return this.notificationSettingsService.updateChannels(actor, dto);
  }

  @Post('rules')
  createRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AlertRuleDto,
  ) {
    return this.alertRulesService.createRule(actor, dto);
  }

  @Put('rules/:ruleId')
  replaceRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: AlertRuleDto,
  ) {
    return this.alertRulesService.replaceRule(actor, ruleId, dto);
  }

  // The table's On switch.
  @Patch('rules/:ruleId')
  setRuleEnabled(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: SetAlertRuleEnabledDto,
  ) {
    return this.alertRulesService.setRuleEnabled(actor, ruleId, dto.isEnabled);
  }

  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.alertRulesService.deleteRule(actor, ruleId);
  }
}
