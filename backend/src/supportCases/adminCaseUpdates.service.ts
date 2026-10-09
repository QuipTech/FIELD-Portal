import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DashboardConfig } from '../dashboard/dashboardConfig';
import { IncomingFile } from '../storage/types/storedFile';
import { listSupportStaff } from './adminSupportCases.repository';
import { updateCase } from './supportCases.repository';
import { markCaseRead } from './caseReads.repository';
import { requireSupportCase } from './requireSupportCase';
import { recordCaseChange } from './recordCaseChange';
import { postMessageToCase } from './postMessageToCase';
import { CaseAccessService, StaffCaseAccess } from './caseAccess.service';
import { CaseAttachmentsService } from './caseAttachments.service';
import { CaseAnnouncer } from './caseAnnouncer.service';
import { AdminSupportCasesService } from './adminSupportCases.service';
import { assertCanPatchCase } from './caseAccessPolicy';
import { buildCasePatch } from './buildCasePatch';
import { UpdateSupportCaseDto } from './dto/updateSupportCaseDto';
import { PostStaffCaseMessageDto } from './dto/postStaffCaseMessageDto';
import { AdminSupportCase } from './types/adminSupportCaseResponse';
import { CaseAttachment, CaseMessage } from './types/supportCaseResponse';
import { SupportCaseRow } from './types/supportCaseRows';

const CASE_NOT_FOUND_MESSAGE = 'Support case not found.';
const NOT_SUPPORT_STAFF_MESSAGE =
  "That person isn't support staff, so they can't take cases.";

// Staff changes to a case, made under the case's own organisation (its RLS
// and audit log). Who may change what is caseAccessPolicy; the case is
// re-read inside the transaction, so an assignee who was just reassigned
// away can't keep working on it.
@Injectable()
export class AdminCaseUpdatesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dashboardConfig: DashboardConfig,
    private readonly caseAccessService: CaseAccessService,
    private readonly caseAttachmentsService: CaseAttachmentsService,
    private readonly caseAnnouncer: CaseAnnouncer,
    private readonly adminSupportCasesService: AdminSupportCasesService,
  ) {}

  updateCase = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    dto: UpdateSupportCaseDto,
  ): Promise<AdminSupportCase> => {
    const access = await this.caseAccessService.requireStaffAccess(
      actor,
      caseNumber,
    );
    assertCanPatchCase(access.role, dto);
    if (dto.assigneeId) await this.assertIsSupportStaff(dto.assigneeId);

    const change = await this.withCase(
      actor,
      access,
      async (client, existing) => {
        const { patch, events } = buildCasePatch(
          existing,
          dto,
          this.dashboardConfig.slaHours,
        );
        await updateCase(client, {
          tenantId: access.caseTenantId,
          caseId: existing.id,
          patch,
        });
        const eventRows = await recordCaseChange(client, {
          tenantId: access.caseTenantId,
          caseId: existing.id,
          caseNumber,
          actorId: actor.userId,
          action: 'update',
          events,
        });
        const row = await requireSupportCase(
          client,
          access.caseTenantId,
          caseNumber,
        );
        return {
          row,
          events: eventRows,
          previousAssigneeId: existing.assignee_id,
        };
      },
    );
    this.caseAnnouncer.announceChange(access.caseTenantId, {
      ...change,
      actorId: actor.userId,
    });
    return this.adminSupportCasesService.getCase(actor, caseNumber);
  };

  // A reply to the customer, or (isInternal) a note only staff can read.
  postMessage = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    dto: PostStaffCaseMessageDto,
  ): Promise<CaseMessage> => {
    const access = await this.caseAccessService.requireStaffAccess(
      actor,
      caseNumber,
    );
    const { posted, message } = await this.withCase(
      actor,
      access,
      async (client, supportCase) => {
        const result = await postMessageToCase(client, {
          tenantId: access.caseTenantId,
          supportCase,
          authorId: actor.userId,
          authorRole: access.role,
          body: dto.body,
          isInternal: dto.isInternal ?? false,
          attachmentIds: dto.attachmentIds ?? [],
        });
        await markCaseRead(client, {
          tenantId: access.caseTenantId,
          caseId: supportCase.id,
          userId: actor.userId,
        });
        const [withAttachments] = await this.caseAttachmentsService.toMessages(
          client,
          access.caseTenantId,
          [result.message],
        );
        return { posted: result, message: withAttachments };
      },
    );
    this.caseAnnouncer.announceMessage(access.caseTenantId, posted, message);
    return message;
  };

  uploadAttachment = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    file: IncomingFile | undefined,
  ): Promise<CaseAttachment> => {
    const access = await this.caseAccessService.requireStaffAccess(
      actor,
      caseNumber,
    );
    return this.withCase(actor, access, (client, supportCase) =>
      this.caseAttachmentsService.upload(client, {
        tenantId: access.caseTenantId,
        caseId: supportCase.id,
        uploaderId: actor.userId,
        file,
      }),
    );
  };

  private withCase = <T>(
    actor: AuthenticatedUser,
    access: StaffCaseAccess,
    work: (client: PoolClient, supportCase: SupportCaseRow) => Promise<T>,
  ): Promise<T> =>
    this.databaseService.withActor(
      { tenantId: access.caseTenantId, userId: actor.userId },
      async (client) => {
        const caseNumber = Number(access.supportCase.case_number);
        const supportCase = await requireSupportCase(
          client,
          access.caseTenantId,
          caseNumber,
        );
        if (
          access.role === 'assignee' &&
          supportCase.assignee_id !== actor.userId
        ) {
          throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
        }
        return work(client, supportCase);
      },
    );

  private assertIsSupportStaff = async (userId: string): Promise<void> => {
    const staff = await listSupportStaff(this.databaseService);
    if (
      !staff.some((member) => member.id === userId && member.is_support_staff)
    ) {
      throw new BadRequestException(NOT_SUPPORT_STAFF_MESSAGE);
    }
  };
}
