import { BadRequestException, ConflictException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { postMessageToCase, NewThreadMessage } from './postMessageToCase';
import * as messagesRepository from './caseMessages.repository';
import * as attachmentsRepository from './caseAttachments.repository';
import * as casesRepository from './supportCases.repository';
import * as changeRecorder from './recordCaseChange';
import * as caseLookup from './requireSupportCase';
import { buildCaseRow, buildMessageRow } from './supportCaseTestRows';

jest.mock('./caseMessages.repository');
jest.mock('./caseAttachments.repository');
jest.mock('./supportCases.repository');
jest.mock('./recordCaseChange');
jest.mock('./requireSupportCase');

const client = {} as PoolClient;

const input = (
  overrides: Partial<NewThreadMessage> = {},
): NewThreadMessage => ({
  tenantId: 'tenant-a',
  supportCase: buildCaseRow({ status: 'waiting_on_customer' }),
  authorId: 'customer-1',
  authorRole: 'customer',
  body: 'Cleaned the sensor, still happening.',
  isInternal: false,
  attachmentIds: [],
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(messagesRepository.insertCaseMessage)
    .mockResolvedValue(buildMessageRow());
  jest.mocked(changeRecorder.recordCaseChange).mockResolvedValue([]);
  jest.mocked(caseLookup.requireSupportCase).mockResolvedValue(buildCaseRow());
});

describe('postMessageToCase', () => {
  it('turns waiting_on_customer back into open when the customer replies', async () => {
    await postMessageToCase(client, input());
    expect(casesRepository.updateCase).toHaveBeenCalledWith(client, {
      tenantId: 'tenant-a',
      caseId: 'case-1',
      patch: { status: 'open' },
    });
    expect(changeRecorder.recordCaseChange).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        events: [
          {
            type: 'status_changed',
            fromValue: 'waiting_on_customer',
            toValue: 'open',
          },
        ],
      }),
    );
  });

  it('leaves the status alone when staff reply', async () => {
    await postMessageToCase(
      client,
      input({ authorId: 'staff-1', authorRole: 'assignee' }),
    );
    expect(casesRepository.updateCase).not.toHaveBeenCalled();
    expect(casesRepository.touchCase).toHaveBeenCalled();
  });

  it('refuses a reply on a resolved case, but takes a staff note', async () => {
    const resolved = buildCaseRow({ status: 'resolved' });
    await expect(
      postMessageToCase(client, input({ supportCase: resolved })),
    ).rejects.toThrow(ConflictException);
    await expect(
      postMessageToCase(
        client,
        input({ supportCase: resolved, authorRole: 'admin', isInternal: true }),
      ),
    ).resolves.toBeDefined();
  });

  it("refuses attachments that weren't the sender's own uploads", async () => {
    jest
      .mocked(attachmentsRepository.linkAttachmentsToMessage)
      .mockResolvedValue(1);
    await expect(
      postMessageToCase(
        client,
        input({
          attachmentIds: [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
          ],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
