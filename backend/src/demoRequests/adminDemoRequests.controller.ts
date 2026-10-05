import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { DemoRequestsService } from './demoRequests.service';
import { ListDemoRequestsQueryDto } from './dto/listDemoRequestsQueryDto';
import { UpdateDemoRequestDto } from './dto/updateDemoRequestDto';

// Demo requests from the marketing site. Platform-wide sales leads, so
// the platform administrator only (Owner, platform.manage) — never an
// organisation's own admins or users, even if AdminScope later gains
// per-organisation admins.
@Controller('admin/demo-requests')
@UseGuards(JwtAuthGuard, AdminScopeGuard, RequirePermissionsGuard)
@RequirePermissions(PLATFORM_PERMISSION_CODE)
export class AdminDemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Get()
  list(@Query() query: ListDemoRequestsQueryDto) {
    return this.demoRequestsService.list(query);
  }

  @Get(':requestId')
  get(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.demoRequestsService.get(requestId);
  }

  @Patch(':requestId')
  update(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateDemoRequestDto,
  ) {
    return this.demoRequestsService.update(requestId, dto);
  }

  @Post(':requestId/resend-emails')
  @HttpCode(HttpStatus.OK)
  resendEmails(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.demoRequestsService.resendEmails(requestId);
  }
}
