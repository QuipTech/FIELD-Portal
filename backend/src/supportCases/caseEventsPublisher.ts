import { Injectable } from '@nestjs/common';
import { Namespace } from 'socket.io';
import { CaseMessage, SupportCase } from './types/supportCaseResponse';

// Every connected portal in the organisation (the cases list).
export const tenantRoom = (tenantId: string) => `tenant:${tenantId}:cases`;

// Everyone with one case open (its chat).
export const caseRoom = (tenantId: string, caseNumber: number) =>
  `tenant:${tenantId}:case:${caseNumber}`;

export const CASE_EVENTS = {
  caseUpdated: 'case:updated',
  message: 'case:message',
  typing: 'case:typing',
} as const;

// Pushes case changes to connected portals. The services call it after a
// change is committed; CaseRealtimeGateway attaches the socket namespace on
// start-up. Before that (or in tests) publishing is a no-op.
@Injectable()
export class CaseEventsPublisher {
  private namespace: Namespace | null = null;

  attach = (namespace: Namespace): void => {
    this.namespace = namespace;
  };

  publishCaseUpdated = (tenantId: string, supportCase: SupportCase): void => {
    this.namespace
      ?.to([tenantRoom(tenantId), caseRoom(tenantId, supportCase.caseNumber)])
      .emit(CASE_EVENTS.caseUpdated, supportCase);
  };

  publishMessage = (
    tenantId: string,
    caseNumber: number,
    message: CaseMessage,
  ): void => {
    this.namespace
      ?.to(caseRoom(tenantId, caseNumber))
      .emit(CASE_EVENTS.message, { caseNumber, message });
  };
}
