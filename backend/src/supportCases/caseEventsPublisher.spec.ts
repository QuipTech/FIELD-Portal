import { Namespace } from 'socket.io';
import {
  CASE_EVENTS,
  CaseEventsPublisher,
  caseRoom,
  caseStaffRoom,
} from './caseEventsPublisher';
import { toCaseMessage } from './supportCaseMapper';
import { buildMessageRow } from './supportCaseTestRows';

// Records which rooms each emit went to.
const fakeNamespace = () => {
  const emits: { rooms: string[]; event: string }[] = [];
  const namespace = {
    to: (rooms: string | string[]) => ({
      emit: (event: string) => {
        emits.push({ rooms: ([] as string[]).concat(rooms), event });
        return true;
      },
    }),
  };
  return { namespace: namespace as unknown as Namespace, emits };
};

describe('CaseEventsPublisher.publishMessage', () => {
  it("sends an internal note only to the case's staff room", () => {
    const { namespace, emits } = fakeNamespace();
    const publisher = new CaseEventsPublisher();
    publisher.attach(namespace);
    publisher.publishMessage(
      1042,
      toCaseMessage(
        buildMessageRow({ author_role: 'admin', is_internal: true }),
      ),
    );
    expect(emits).toEqual([
      { rooms: [caseStaffRoom(1042)], event: CASE_EVENTS.message },
    ]);
  });

  it('sends a reply to everyone with the case open', () => {
    const { namespace, emits } = fakeNamespace();
    const publisher = new CaseEventsPublisher();
    publisher.attach(namespace);
    publisher.publishMessage(1042, toCaseMessage(buildMessageRow()));
    expect(emits).toEqual([
      { rooms: [caseRoom(1042)], event: CASE_EVENTS.message },
    ]);
  });
});
