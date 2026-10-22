import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { RequireActiveMachineGuard } from '../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { MachineConfigurationService } from './machineConfiguration.service';
import { SnapshotDiffService } from './snapshotDiff.service';
import { SnapshotRestoreService } from './snapshotRestore.service';
import { ListComponentsQueryDto } from './dto/listComponentsQueryDto';
import { ExportSnapshotDiffQueryDto, SnapshotDiffQueryDto } from './dto/snapshotDiffQueryDto';
import { UpdateSnapshotDto } from './dto/updateSnapshotDto';

// A machine's systems & components and its configuration snapshots, for
// the portal's Components and Configuration history tabs.
@Controller('machines/:machineId')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard, RequireActiveMachineGuard)
export class MachineConfigurationController {
  constructor(
    private readonly machineConfigurationService: MachineConfigurationService,
    private readonly snapshotDiffService: SnapshotDiffService,
    private readonly snapshotRestoreService: SnapshotRestoreService,
  ) {}

  @Get('systems')
  @RequirePermissions('machine.view')
  listSystems(@CurrentUser() user: AuthenticatedUser, @Param('machineId', ParseUUIDPipe) machineId: string) {
    return this.machineConfigurationService.listSystems(user, machineId);
  }

  @Get('components')
  @RequirePermissions('machine.view')
  listComponents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: ListComponentsQueryDto,
  ) {
    return this.machineConfigurationService.listComponents(user, machineId, query.system ?? null);
  }

  @Get('snapshots')
  @RequirePermissions('machine.view')
  listSnapshots(@CurrentUser() user: AuthenticatedUser, @Param('machineId', ParseUUIDPipe) machineId: string) {
    return this.machineConfigurationService.listSnapshots(user, machineId);
  }

  @Post('snapshots')
  @RequirePermissions('history.create')
  takeSnapshot(@CurrentUser() user: AuthenticatedUser, @Param('machineId', ParseUUIDPipe) machineId: string) {
    return this.machineConfigurationService.takeSnapshot(user, machineId);
  }

  // Field-level comparison; /compare is the mobile app's name for it.
  @Get(['snapshots/diff', 'snapshots/compare'])
  @RequirePermissions('machine.view')
  getDiff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: SnapshotDiffQueryDto,
  ) {
    return this.snapshotDiffService.getDiff(user, { machineId, fromId: query.from, toId: query.to });
  }

  @Get('snapshots/diff/export')
  @RequirePermissions('machine.view')
  async exportDiff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: ExportSnapshotDiffQueryDto,
    @Res() response: Response,
  ) {
    const file = await this.snapshotDiffService.exportDiff(
      user,
      { machineId, fromId: query.from, toId: query.to },
      query.format,
    );
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    response.send(typeof file.body === 'string' ? file.body : Buffer.from(file.body));
  }

  // Puts the recorded configuration back to this snapshot (see SnapshotRestoreService).
  @Post('snapshots/:snapshotId/restore')
  @RequirePermissions('machine.manage')
  restoreSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
  ) {
    return this.snapshotRestoreService.restore(user, { machineId, snapshotId });
  }

  @Patch('snapshots/:snapshotId')
  @RequirePermissions('machine.manage')
  updateSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
    @Body() dto: UpdateSnapshotDto,
  ) {
    return this.machineConfigurationService.setKnownGood(user, { machineId, snapshotId }, dto.isKnownGood);
  }
}
