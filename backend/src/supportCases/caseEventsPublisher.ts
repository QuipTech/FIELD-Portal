import { Injectable } from '@nestjs/common';
import { Namespace } from 'socket.io';
import {
  CaseEvent,
  CaseMessage,
  SupportCase,
} from './types/supportCaseResponse';

// Every connected portal in an organisation (its cases list).
export const tenantRoom = (tenantId: string) => `tenant:${tenantId}:cases`;

// Everyone allowed to have one case open: its customers and its staff.
// Case numbers are unique across organisations.
export const caseRoom = (caseNumber: number) => `case:${caseNumber}`;

// Only the case's staff (admin, assignee): internal notes go here alone.
export const caseStaffRoom = (caseNumber: number) => `case:${caseNumber}:staff`;

// Support admins see the whole queue; a Support Agent only their cases.
export const SUPPORT_ADMINS_ROOM = 'support:admins';
export const agentRoom = (userId: string) => `support:agent:${userId}`;

export const CASE_EVENTS = {
  caseUpdated: 'case:updated',
  message: 'case:message',
  event: 'case:event',
  typing: 'case:typing',
} as const;

// Pushes case changes to connected portals. Services call it after a
// change is committed; CaseRealtimeGateway attaches the socket namespace on
// start-up. Before that (or in tests) publishing is a no-op.
@Injectable()
export class CaseEventsPublisher {
  private namespace: Namespace | null = null;

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
  };

  // previousAssigneeId: a reassigned case also leaves the old assignee's queue.
  publishCaseUpdated = (
    tenantId: string,
    supportCase: SupportCase,
    previousAssigneeId: string | null = null,
  ): void => {
    const agentIds = [supportCase.assignee?.id, previousAssigneeId].filter(
      (id): id is string => Boolean(id),
    );
    this.namespace
      ?.to([
        tenantRoom(tenantId),
        caseRoom(supportCase.caseNumber),
        SUPPORT_ADMINS_ROOM,
        ...agentIds.map(agentRoom),
      ])
      .emit(CASE_EVENTS.caseUpdated, supportCase);
  };

  publishMessage = (caseNumber: number, message: CaseMessage): void => {
    const room = message.isInternal
      ? caseStaffRoom(caseNumber)
      : caseRoom(caseNumber);
    this.namespace?.to(room).emit(CASE_EVENTS.message, { caseNumber, message });
  };

  publishEvents = (caseNumber: number, events: CaseEvent[]): void => {
    events.forEach((event) =>
      this.namespace
        ?.to(caseRoom(caseNumber))
        .emit(CASE_EVENTS.event, { caseNumber, event }),
    );
  };
}
