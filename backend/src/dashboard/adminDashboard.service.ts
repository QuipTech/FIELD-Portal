import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { findUserPermissionCodes } from '../auth/userAccess.repository';
import { toMeCapabilities } from '../auth/meCapabilities';
import { toDocumentDisplayTitle } from '../knowledge/documentDisplayTitle';
import { KnowledgeAccessService } from '../knowledgeCatalog/access/knowledgeAccess.service';
import { listCatalogDocuments } from '../knowledgeCatalog/documents/catalogDocuments.repository';
import { ListCatalogDocumentsQueryDto } from '../knowledgeCatalog/dto/listCatalogDocumentsQueryDto';
import { listDownMachines } from './dashboardCounts.repository';
import * as adminRepository from './adminDashboard.repository';
import { AdminDashboard } from './types/adminDashboardResponse';

const NOT_ADMIN_MESSAGE = 'Only administrators see the admin dashboard.';
const LISTED_BULLETINS = 5;

// The admin home: what needs someone's attention in the organisation.
// For organisation, Knowledge and platform admins (capabilities from
// /auth/me); everyone else uses GET /dashboard.
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  getAdminDashboard = async (
    actor: AuthenticatedUser,
  ): Promise<AdminDashboard> => {
    const access = await this.knowledgeAccess.resolve(actor);
    return this.databaseService.withTenant(actor.tenantId, async (client) => {
      const capabilities = toMeCapabilities(
        await findUserPermissionCodes(client, actor.userId),
      );
      if (
        !capabilities.isOrganisationAdmin &&
        !capabilities.isKnowledgeAdmin &&
        !capabilities.isPlatformAdmin
      ) {
        throw new ForbiddenException(NOT_ADMIN_MESSAGE);
      }
      const down = await listDownMachines(client, actor.tenantId);
      const nearBreach = await adminRepository.listCasesNearSlaBreach(
        client,
        actor.tenantId,
      );
      // Admin access so the status filter applies, whatever the caller's
      // Knowledge role; brands still follow the plan.
      const bulletins = await listCatalogDocuments(
        client,
        { ...access, isAdmin: true },
        Object.assign(new ListCatalogDocumentsQueryDto(), {
          type: 'bulletin',
          status: 'needs_review',
          pageSize: LISTED_BULLETINS,
        }),
      );
      return {
        machinesDown: {
          total: Number(down[0]?.total ?? 0),
          machines: down.map((row) => ({ id: row.id, label: row.label })),
        },
        casesNearSlaBreach: {
          total: Number(nearBreach[0]?.total_count ?? 0),
          breached: Number(nearBreach[0]?.breached_count ?? 0),
          cases: nearBreach.map((row) => ({
            caseNumber: Number(row.case_number),
            subject: row.subject,
            priority: row.priority,
            slaDueAt: row.sla_due_at.toISOString(),
            slaState: row.sla_state,
          })),
        },
        aiAnswersToReview: {
          total: await adminRepository.countAnswersToReview(
            client,
            actor.tenantId,
          ),
        },
        bulletinsToApprove: {
          total: Number(bulletins[0]?.total_count ?? 0),
          documents: bulletins.map((row) => ({
            id: row.id,
            title: toDocumentDisplayTitle(row.title),
          })),
        },
      };
    });
  };
}
