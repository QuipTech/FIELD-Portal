import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { toFleetMachine } from '../machineFleet/machineFleetMapper';
import { DashboardConfig } from './dashboardConfig';
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
// organisation (and, for threads and "my machines", to the caller).
@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dashboardConfig: DashboardConfig,
  ) {}

  getSummary = async (actor: AuthenticatedUser): Promise<DashboardSummary> => {
    const now = new Date();
    const knowledgeRows = await activityRepository.listKnowledgeActivity(
      this.databaseService,
      actor.tenantId,
    );
    return this.databaseService.withTenant(actor.tenantId, async (client) => {
      const tenantAndUser = { tenantId: actor.tenantId, userId: actor.userId };
      const downRows = await countsRepository.listDownMachines(
        client,
        actor.tenantId,
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
        openCases: await this.loadOpenCases(client, actor.tenantId),
        machinesDown: {
          total: Number(downRows[0]?.total ?? 0),
          machines: downRows.map((row) => ({ id: row.id, label: row.label })),
        },
        entriesThisWeek: {
          total: Number(entries.total),
          mine: Number(entries.mine),
        },
        fleetUptime: await this.loadFleetUptime(client, actor.tenantId, now),
        recentActivity: mergeActivity(
          [
            ...(await this.loadTenantActivity(client, actor)),
            ...knowledgeRows.map(knowledgeToActivity),
          ],
          activityRepository.ACTIVITY_LIMIT,
        ),
        myMachines: myMachines.map(toFleetMachine),
      };
    });
  };

  private loadOpenCases = async (
    client: PoolClient,
    tenantId: string,
  ): Promise<OpenCasesSummary> => {
    const row = await countsRepository.countOpenCases(
      client,
      tenantId,
      this.dashboardConfig.slaHours,
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
    tenantId: string,
    now: Date,
  ): Promise<FleetUptime> => {
    const rows = await uptimeRepository.listStatusEvents(client, {
      tenantId,
      windowStart: uptimeWindowStart(now),
    });
    const trackingSince = await uptimeRepository.findTrackingStart(
      client,
      tenantId,
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
    actor: AuthenticatedUser,
  ): Promise<ActivityItem[]> => {
    const cases = await activityRepository.listCaseActivity(
      client,
      actor.tenantId,
    );
    const entries = await activityRepository.listEntryActivity(
      client,
      actor.tenantId,
    );
    const threads = await activityRepository.listThreadActivity(client, {
      tenantId: actor.tenantId,
      userId: actor.userId,
    });
    return [
      ...cases.map(caseToActivity),
      ...entries.map(entryToActivity),
      ...threads.map(threadToActivity),
    ];
  };
}
