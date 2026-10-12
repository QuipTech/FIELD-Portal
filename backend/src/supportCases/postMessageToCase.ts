import { BadRequestException, ConflictException } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  canPostToCase,
  resolveStatusAfterCustomerReply,
} from './caseAccessPolicy';
import { insertCaseMessage } from './caseMessages.repository';
import { linkAttachmentsToMessage } from './caseAttachments.repository';
import { touchCase, updateCase } from './supportCases.repository';
import { recordCaseChange } from './recordCaseChange';
import { requireSupportCase } from './requireSupportCase';
import { CaseAuthorRole, CaseStatus } from './types/supportCaseResponse';
import {
  CaseEventRow,
  CaseMessageRow,
  SupportCaseRow,
} from './types/supportCaseRows';

const CASE_NOT_ACTIVE_MESSAGE =
  'This case is resolved or closed. Reopen it before replying.';
const UNKNOWN_ATTACHMENT_MESSAGE =
  "One of those attachments isn't yours to send, or was already sent.";

export interface NewThreadMessage {
  // The case's organisation (staff work under it too).
  tenantId: string;
  supportCase: SupportCaseRow;
  authorId: string;
  authorRole: CaseAuthorRole;
  body: string;
  isInternal: boolean;
  attachmentIds: string[];
}

export interface PostedThreadMessage {
  message: CaseMessageRow;
  events: CaseEventRow[];
  supportCase: SupportCaseRow;
}

// The one way a message joins a thread, for customers and staff alike,
// inside the caller's transaction: saves it, attaches the sender's own
// uploads, and (for a customer) restarts a case that was waiting on them.
export const postMessageToCase = async (
  client: PoolClient,
  input: NewThreadMessage,
): Promise<PostedThreadMessage> => {
  const status = input.supportCase.status as CaseStatus;
  if (!canPostToCase(status, input.isInternal)) {
    throw new ConflictException(CASE_NOT_ACTIVE_MESSAGE);
  }
  const caseId = input.supportCase.id;
  const caseNumber = Number(input.supportCase.case_number);
  const message = await insertCaseMessage(client, {
    tenantId: input.tenantId,
    caseId,
    authorId: input.authorId,
    authorRole: input.authorRole,
    body: input.body,
    isInternal: input.isInternal,
  });
  if (input.attachmentIds.length) {
    const linked = await linkAttachmentsToMessage(client, {
      tenantId: input.tenantId,
      caseId,
      messageId: message.id,
      uploaderId: input.authorId,
      attachmentIds: input.attachmentIds,
    });
    if (linked !== new Set(input.attachmentIds).size) {
      throw new BadRequestException(UNKNOWN_ATTACHMENT_MESSAGE);
    }
  }

  const nextStatus =
    input.authorRole === 'customer'
      ? resolveStatusAfterCustomerReply(status)
      : status;
  let events: CaseEventRow[] = [];
  if (nextStatus !== status) {
    await updateCase(client, {
      tenantId: input.tenantId,
      caseId,
      patch: { status: nextStatus },
    });
    events = await recordCaseChange(client, {
      tenantId: input.tenantId,
      caseId,
      caseNumber,
      actorId: input.authorId,
      action: 'update',
      events: [
        { type: 'status_changed', fromValue: status, toValue: nextStatus },
      ],
    });
  } else {
    await touchCase(client, input.tenantId, caseId);
  }
  const supportCase = await requireSupportCase(
    client,
    input.tenantId,
    caseNumber,
  );
  return { message, events, supportCase };
};
