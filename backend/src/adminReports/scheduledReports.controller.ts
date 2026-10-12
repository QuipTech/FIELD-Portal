import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { ScheduledReportsService } from './schedules/scheduledReports.service';
import { ScheduledReportDto } from './dto/scheduledReportDto';

// Settings → Reports & exports, Scheduled reports. Platform-wide: every
// schedule reports on every organisation (AdminScopeGuard = Owner only).
@Controller('admin/reports/schedules')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class ScheduledReportsController {
  constructor(
    private readonly scheduledReportsService: ScheduledReportsService,
  ) {}

  @Get()
  list() {
    return this.scheduledReportsService.listSchedules();
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ScheduledReportDto,
  ) {
    return this.scheduledReportsService.createSchedule(actor, dto);
  }

  @Put(':scheduleId')
  replace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: ScheduledReportDto,
  ) {
    return this.scheduledReportsService.replaceSchedule(actor, scheduleId, dto);
  }

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.scheduledReportsService.deleteSchedule(actor, scheduleId);
  }

  @Post(':scheduleId/send')
  @HttpCode(HttpStatus.OK)
  sendNow(@Param('scheduleId', ParseUUIDPipe) scheduleId: string) {
    return this.scheduledReportsService.sendNow(scheduleId);
  }
}
