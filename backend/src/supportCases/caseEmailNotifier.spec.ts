import { chooseReplyRecipient } from './caseEmailNotifier.service';
import { toCaseMessage } from './supportCaseMapper';
import { buildCaseRow, buildMessageRow } from './supportCaseTestRows';

const staffReply = (overrides = {}) =>
  toCaseMessage(
    buildMessageRow({
      author_id: 'staff-1',
      author_first_name: 'Tobias',
      author_last_name: 'Meyer',
      author_role: 'assignee',
      ...overrides,
    }),
  );

describe('chooseReplyRecipient', () => {
  it('emails the customer when staff reply, linking the customer screen', () => {
    expect(chooseReplyRecipient(buildCaseRow(), staffReply())).toMatchObject({
      email: 'ada@mine.example',
      path: '/cases/1042',
    });
  });

  it('emails the assignee when the customer replies, linking the admin screen', () => {
    expect(
      chooseReplyRecipient(buildCaseRow(), toCaseMessage(buildMessageRow())),
    ).toMatchObject({
      email: 'tobias@quiptech.example',
      path: '/admin/cases/1042',
    });
  });

  it('never emails the customer about an internal note', () => {
    expect(
      chooseReplyRecipient(buildCaseRow(), staffReply({ is_internal: true })),
    ).toBeNull();
  });

  it('emails nobody when there is no assignee yet', () => {
    expect(
      chooseReplyRecipient(
        buildCaseRow({ assignee_id: null, assignee_email: null }),
        toCaseMessage(buildMessageRow()),
      ),
    ).toBeNull();
  });
});
