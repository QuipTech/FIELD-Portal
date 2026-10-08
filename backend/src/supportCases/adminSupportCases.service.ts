import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as adminRepository from './adminSupportCases.repository';
import { listCaseMessages } from './caseMessages.repository';
import { listCaseEvents } from './caseEvents.repository';
import { markCaseRead } from './caseReads.repository';
import { CaseAccessService } from './caseAccess.service';
import { CaseAttachmentsService } from './caseAttachments.service';
import { SupportStaffContext } from './supportStaff.guard';
import { toCaseEvent, toSupportCase } from './supportCaseMapper';
import {
  toAdminCaseListItem,
  toAdminCaseStats,
  toSupportStaffMember,
} from './adminSupportCaseMapper';
import { ListAdminSupportCasesQueryDto } from './dto/listAdminSupportCasesQueryDto';
import {
  AdminCaseStats,
  AdminSupportCase,
  AdminSupportCaseList,
  SupportStaffMember,
} from './types/adminSupportCaseResponse';
import { CaseEvent, CaseMessage } from './types/supportCaseResponse';

const DEFAULT_PAGE_SIZE = 25;

// A Support Agent sees only their own cases; the admin sees every case.
const onlyAssigneeFor = (
  actor: AuthenticatedUser,
  staff: SupportStaffContext,
) => (staff.isAdmin ? null : actor.userId);

// The staff side's reads: the queue (A13) and one case's detail (A13b),
// internal notes included.
@Injectable()
export class AdminSupportCasesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly caseAccessService: CaseAccessService,
    private readonly caseAttachmentsService: CaseAttachmentsService,
  ) {}

  listCases = async (
    actor: AuthenticatedUser,
    staff: SupportStaffContext,
    query: ListAdminSupportCasesQueryDto,
  ): Promise<AdminSupportCaseList> => {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const rows = await adminRepository.listAdminCases(this.databaseService, {
      viewerId: actor.userId,
      onlyAssigneeId: onlyAssigneeFor(actor, staff),
      tab: query.tab ?? 'open',
      tenantId: query.company ?? null,
      priority: query.priority ?? null,
      status: query.status ?? null,
      search: query.search ?? null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items: rows.map(toAdminCaseListItem),
      total: Number(rows[0]?.total_count ?? 0),
      page,
      pageSize,
    };
  };

  getStats = async (
    actor: AuthenticatedUser,
    staff: SupportStaffContext,
  ): Promise<AdminCaseStats> =>
    toAdminCaseStats(
      await adminRepository.findAdminCaseStats(this.databaseService, {
        viewerId: actor.userId,
        onlyAssigneeId: onlyAssigneeFor(actor, staff),
      }),
    );

  listStaff = async (): Promise<SupportStaffMember[]> =>
    (await adminRepository.listSupportStaff(this.databaseService)).map(
      toSupportStaffMember,
    );

  countUnread = async (
    actor: AuthenticatedUser,
  ): Promise<{ count: number }> => ({
    count: await adminRepository.countUnreadCasesForStaff(
      this.databaseService,
      actor.userId,
    ),
  });

  getCase = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<AdminSupportCase> => {
    const access = await this.caseAccessService.requireStaffAccess(
      actor,
      caseNumber,
    );
    const company = await this.databaseService.withTenant(
      access.caseTenantId,
      (client) => adminRepository.findCaseCompany(client, access.caseTenantId),
    );
    return {
      ...toSupportCase(access.supportCase),
      company,
      reporterEmail: access.supportCase.reporter_email,
      viewerRole: access.role,
    };
  };

  listMessages = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<CaseMessage[]> => {
    const { caseTenantId, supportCase } =
      await this.caseAccessService.requireStaffAccess(actor, caseNumber);
    return this.databaseService.withTenant(caseTenantId, async (client) => {
      const rows = await listCaseMessages(client, {
        tenantId: caseTenantId,
        caseId: supportCase.id,
        includeInternal: true,
      });
      return this.caseAttachmentsService.toMessages(client, caseTenantId, rows);
    });
  };

  listEvents = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<CaseEvent[]> => {
    const { caseTenantId, supportCase } =
      await this.caseAccessService.requireStaffAccess(actor, caseNumber);
    return this.databaseService.withTenant(caseTenantId, async (client) =>
      (await listCaseEvents(client, caseTenantId, supportCase.id)).map(
        toCaseEvent,
      ),
    );
  };

  markRead = async (
    actor: AuthenticatedUser,
    caseNumber: number,
  ): Promise<void> => {
    const { caseTenantId, supportCase } =
      await this.caseAccessService.requireStaffAccess(actor, caseNumber);
    await this.databaseService.withTenant(caseTenantId, (client) =>
      markCaseRead(client, {
        tenantId: caseTenantId,
        caseId: supportCase.id,
        userId: actor.userId,
      }),
    );
  };
}
