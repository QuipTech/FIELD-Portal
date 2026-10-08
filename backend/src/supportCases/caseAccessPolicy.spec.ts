import { ForbiddenException } from '@nestjs/common';
import {
  assertCanPatchCase,
  canPostToCase,
  canReopenCase,
  canSeeInternalNotes,
  CaseViewer,
  resolveCaseViewerRole,
  resolveStatusAfterCustomerReply,
  resolveStatusAfterPatch,
} from './caseAccessPolicy';

const CASE_IN_A = { tenantId: 'tenant-a', assigneeId: 'staff-1' };

const customerOf = (tenantId: string): CaseViewer => ({
  userId: 'customer-1',
  tenantId,
  permissions: ['support.create', 'machine.view'],
});
const agent = (userId: string): CaseViewer => ({
  userId,
  tenantId: 'quiptech',
  permissions: ['support.create', 'support.agent'],
});
const admin: CaseViewer = {
  userId: 'admin-1',
  tenantId: 'quiptech',
  permissions: ['support.create', 'support.agent', 'platform.manage'],
};

describe('resolveCaseViewerRole', () => {
  it("lets a customer see their own company's case", () => {
    expect(resolveCaseViewerRole(customerOf('tenant-a'), CASE_IN_A)).toBe(
      'customer',
    );
  });

  it("refuses a customer another company's case", () => {
    expect(resolveCaseViewerRole(customerOf('tenant-b'), CASE_IN_A)).toBeNull();
  });

  it('lets a support agent see only the cases assigned to them', () => {
    expect(resolveCaseViewerRole(agent('staff-1'), CASE_IN_A)).toBe('assignee');
    expect(resolveCaseViewerRole(agent('staff-2'), CASE_IN_A)).toBeNull();
  });

  it('lets the admin see every case', () => {
    expect(resolveCaseViewerRole(admin, CASE_IN_A)).toBe('admin');
    expect(
      resolveCaseViewerRole(admin, { tenantId: 'tenant-z', assigneeId: null }),
    ).toBe('admin');
  });
});

describe('canSeeInternalNotes', () => {
  it('is staff only', () => {
    expect(canSeeInternalNotes('customer')).toBe(false);
    expect(canSeeInternalNotes('assignee')).toBe(true);
    expect(canSeeInternalNotes('admin')).toBe(true);
  });
});

describe('assertCanPatchCase', () => {
  it('lets only the admin or the assignee change the status', () => {
    expect(() =>
      assertCanPatchCase('admin', { status: 'resolved' }),
    ).not.toThrow();
    expect(() =>
      assertCanPatchCase('assignee', { status: 'resolved' }),
    ).not.toThrow();
    expect(() =>
      assertCanPatchCase('customer', { status: 'resolved' }),
    ).toThrow(ForbiddenException);
  });

  it('keeps assigning and priority to the admin', () => {
    expect(() => assertCanPatchCase('assignee', { priority: 'P1' })).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanPatchCase('assignee', { assigneeId: null })).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertCanPatchCase('admin', { assigneeId: 'staff-2', priority: 'P1' }),
    ).not.toThrow();
  });

  it('keeps closing to the admin, and never sets "new" directly', () => {
    expect(() => assertCanPatchCase('assignee', { status: 'closed' })).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertCanPatchCase('admin', { status: 'closed' }),
    ).not.toThrow();
    expect(() => assertCanPatchCase('admin', { status: 'new' })).toThrow(
      ForbiddenException,
    );
  });
});

describe('resolveStatusAfterPatch', () => {
  it('opens a new case when it is assigned', () => {
    expect(
      resolveStatusAfterPatch('new', null, { assigneeId: 'staff-1' }),
    ).toBe('open');
  });

  it('puts an open case back to new when it is unassigned', () => {
    expect(
      resolveStatusAfterPatch('open', 'staff-1', { assigneeId: null }),
    ).toBe('new');
  });

  it('leaves the status alone on a reassignment, and lets an explicit status win', () => {
    expect(
      resolveStatusAfterPatch('waiting_on_customer', 'staff-1', {
        assigneeId: 'staff-2',
      }),
    ).toBe('waiting_on_customer');
    expect(
      resolveStatusAfterPatch('new', null, {
        assigneeId: 'staff-1',
        status: 'resolved',
      }),
    ).toBe('resolved');
  });
});

describe('resolveStatusAfterCustomerReply', () => {
  it('turns waiting on customer back into open', () => {
    expect(resolveStatusAfterCustomerReply('waiting_on_customer')).toBe('open');
  });

  it('leaves every other status alone', () => {
    expect(resolveStatusAfterCustomerReply('new')).toBe('new');
    expect(resolveStatusAfterCustomerReply('open')).toBe('open');
  });
});

describe('canPostToCase', () => {
  it('takes replies only on an active case, and staff notes until it is closed', () => {
    expect(canPostToCase('open', false)).toBe(true);
    expect(canPostToCase('resolved', false)).toBe(false);
    expect(canPostToCase('resolved', true)).toBe(true);
    expect(canPostToCase('closed', true)).toBe(false);
  });
});

describe('canReopenCase', () => {
  const now = new Date('2026-10-08T12:00:00Z');

  it('allows reopening within 7 days of being resolved', () => {
    expect(
      canReopenCase('resolved', new Date('2026-10-02T12:00:00Z'), now),
    ).toBe(true);
  });

  it('refuses after 7 days, or a case that is not resolved', () => {
    expect(
      canReopenCase('resolved', new Date('2026-09-30T12:00:00Z'), now),
    ).toBe(false);
    expect(canReopenCase('closed', new Date('2026-10-07T12:00:00Z'), now)).toBe(
      false,
    );
  });
});
