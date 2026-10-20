import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { CaseAccessService, StaffCaseAccess } from './caseAccess.service';
import { CaseAttachmentsService } from './caseAttachments.service';
import { CaseEventsPublisher } from './caseEventsPublisher';
import { findCaseMessage } from './caseMessages.repository';
import {
  findNoteAuthorId,
  softDeleteNote,
  updateNoteBody,
} from './caseNotes.repository';
import { withStaffCase } from './withStaffCase';
import { CaseMessage } from './types/supportCaseResponse';

const NOTE_NOT_FOUND_MESSAGE = 'Note not found.';
const NOT_NOTE_AUTHOR_MESSAGE =
  'Only the person who wrote this note, or a support admin, can change it.';

interface NoteTarget {
  client: PoolClient;
  key: { tenantId: string; caseId: string; noteId: string };
}

// Editing and deleting internal notes. The note's author may change it,
// and so may the support admin; other staff only read it.
@Injectable()
export class AdminCaseNotesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly caseAccessService: CaseAccessService,
    private readonly caseAttachmentsService: CaseAttachmentsService,
    private readonly publisher: CaseEventsPublisher,
  ) {}

  updateNote = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    noteId: string,
    body: string,
  ): Promise<CaseMessage> => {
    const message = await this.withOwnNote(
      actor,
      caseNumber,
      noteId,
      async ({ client, key }) => {
        await updateNoteBody(client, { ...key, body });
        const [updated] = await this.caseAttachmentsService.toMessages(
          client,
          key.tenantId,
          [await findCaseMessage(client, noteId)],
        );
        return updated;
      },
    );
    this.publisher.publishMessage(caseNumber, message);
    return message;
  };

  deleteNote = async (
    actor: AuthenticatedUser,
    caseNumber: number,
    noteId: string,
  ): Promise<void> => {
    await this.withOwnNote(actor, caseNumber, noteId, ({ client, key }) =>
      softDeleteNote(client, key),
    );
    this.publisher.publishNoteDeleted(caseNumber, noteId);
  };

  private withOwnNote = async <T>(
    actor: AuthenticatedUser,
    caseNumber: number,
    noteId: string,
    work: (target: NoteTarget) => Promise<T>,
  ): Promise<T> => {
    const access = await this.caseAccessService.requireStaffAccess(
      actor,
      caseNumber,
    );
    return withStaffCase(
      this.databaseService,
      actor,
      access,
      async (client, supportCase) => {
        const key = {
          tenantId: access.caseTenantId,
          caseId: supportCase.id,
          noteId,
        };
        const authorId = await findNoteAuthorId(client, key);
        if (authorId === undefined) {
          throw new NotFoundException(NOTE_NOT_FOUND_MESSAGE);
        }
        this.assertCanChange(access, authorId, actor.userId);
        return work({ client, key });
      },
    );
  };

  private assertCanChange = (
    access: StaffCaseAccess,
    authorId: string | null,
    userId: string,
  ): void => {
    if (access.role !== 'admin' && authorId !== userId) {
      throw new ForbiddenException(NOT_NOTE_AUTHOR_MESSAGE);
    }
  };
}
