import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { StorageService } from '../storage/storage.service';
import { toFleetMachineWithPhoto } from '../machineFleet/machinePhotoUrl';
import { DashboardConfig } from './dashboardConfig';
import { getAccessibleMachineScope } from '../machineGroups/access/getAccessibleMachineScope';
import { MachineScope } from '../machineGroups/access/machineScope';
import * as countsRepository from './dashboardCounts.repository';
import * as uptimeRepository from './fleetUptime.repository';
import * as myMachinesRepository from './myMachines.repository';
import * as activityRepository from './recentActivity.repository';
import { computeFleetUptime, uptimeWindowStart } from './computeFleetUptime';
import {
  caseToActivity,
  entryToActivity,
  knowledgeToActivity,
  mergeActivity,
  threadToActivity,
} from './recentActivityMapper';
import {
  ActivityItem,
  DashboardSummary,
  FleetUptime,
  OpenCasesSummary,
} from './types/dashboardResponse';

// The Dashboard screen in one request, scoped to the caller's
// organisation and machine scope (machineGroups/access), and for threads
// and "my machines" to the caller.
@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dashboardConfig: DashboardConfig,
    private readonly storageService: StorageService,
  ) {}

  getSummary = async (actor: AuthenticatedUser): Promise<DashboardSummary> => {
    const now = new Date();
    const knowledgeRows = await activityRepository.listKnowledgeActivity(
      this.databaseService,
      actor.tenantId,
    );
    return this.databaseService.withTenant(actor.tenantId, async (client) => {
      const scope = await getAccessibleMachineScope(client, actor);
      const tenantAndUser = {
        tenantId: actor.tenantId,
        userId: actor.userId,
        scope,
      };
      const downRows = await countsRepository.listDownMachines(
        client,
        actor.tenantId,
        scope,
      );
      const entries = await countsRepository.countEntriesThisWeek(
        client,
        tenantAndUser,
      );
      const myMachines = await myMachinesRepository.listMyMachines(
        client,
        tenantAndUser,
      );
      return {
        openCases: await this.loadOpenCases(client, actor.tenantId, scope),
        machinesDown: {
          total: Number(downRows[0]?.total ?? 0),
          machines: downRows.map((row) => ({ id: row.id, label: row.label })),
        },
        entriesThisWeek: {
          total: Number(entries.total),
          mine: Number(entries.mine),
        },
        fleetUptime: await this.loadFleetUptime(client, tenantAndUser, now),
        recentActivity: mergeActivity(
          [
            ...(await this.loadTenantActivity(client, tenantAndUser)),
            ...knowledgeRows.map(knowledgeToActivity),
          ],
          activityRepository.ACTIVITY_LIMIT,
        ),
        myMachines: await Promise.all(
          myMachines.map((row) =>
            toFleetMachineWithPhoto(this.storageService, row),
          ),
        ),
      };
    });
  };

  private loadOpenCases = async (
    client: PoolClient,
    tenantId: string,
    scope: MachineScope,
  ): Promise<OpenCasesSummary> => {
    const row = await countsRepository.countOpenCases(
      client,
      tenantId,
      this.dashboardConfig.slaHours,
      scope,
    );
    return {
      total: Number(row.total),
      breachingSla: Number(row.breaching),
      byPriority: {
        P1: Number(row.p1),
        P2: Number(row.p2),
        P3: Number(row.p3),
      },
    };
  };

  private loadFleetUptime = async (
    client: PoolClient,
    viewer: { tenantId: string; scope: MachineScope },
    now: Date,
  ): Promise<FleetUptime> => {
    const rows = await uptimeRepository.listStatusEvents(client, {
      ...viewer,
      windowStart: uptimeWindowStart(now),
    });
    const trackingSince = await uptimeRepository.findTrackingStart(
      client,
      viewer.tenantId,
    );
    return computeFleetUptime(
      rows.map((row) => ({
        machineId: row.machine_id,
        status: row.status,
        changedAt: new Date(row.changed_at),
      })),
      trackingSince ? new Date(trackingSince) : null,
      now,
    );
  };

  private loadTenantActivity = async (
    client: PoolClient,
    viewer: { tenantId: string; userId: string; scope: MachineScope },
  ): Promise<ActivityItem[]> => {
    const cases = await activityRepository.listCaseActivity(
      client,
      viewer.tenantId,
      viewer.scope,
    );
    const entries = await activityRepository.listEntryActivity(
      client,
      viewer.tenantId,
      viewer.scope,
    );
    const threads = await activityRepository.listThreadActivity(client, viewer);
    return [
      ...cases.map(caseToActivity),
      ...entries.map(entryToActivity),
      ...threads.map(threadToActivity),
    ];
  };
}
