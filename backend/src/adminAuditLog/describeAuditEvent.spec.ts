import { describeAuditEvent } from './describeAuditEvent';
import { labelEventType } from './auditEventLabels';

const event = (
  entity_type: string,
  action: string,
  metadata: Record<string, unknown> = {},
  target_name: string | null = null,
) => ({
  entity_type,
  action,
  metadata,
  target_name,
});

describe('describeAuditEvent', () => {
  it("names a sign-in by the user's email", () => {
    expect(
      describeAuditEvent(event('user', 'login', {}, 'r.mbeki@quiptech.com')),
    ).toEqual({
      actionLabel: 'Signed in',
      target: 'r.mbeki@quiptech.com',
    });
  });

  it('spells out a role permission change', () => {
    const metadata = {
      before: {
        name: 'Supervisor',
        permissionCodes: ['audit.view', 'machine.view'],
      },
      after: { permissionCodes: ['machine.view', 'knowledge.publish'] },
    };
    expect(
      describeAuditEvent(event('role', 'update', metadata, 'Supervisor')),
    ).toEqual({
      actionLabel: 'Changed role permissions',
      target: 'Supervisor · +knowledge.publish, −audit.view',
    });
  });

  it('shows a role rename as old → new', () => {
    const metadata = {
      before: { name: 'Tech' },
      after: { name: 'Technician' },
    };
    expect(describeAuditEvent(event('role', 'update', metadata)).target).toBe(
      'Tech → Technician',
    );
  });

  it('falls back to the metadata title for a deleted document', () => {
    expect(
      describeAuditEvent(
        event('knowledge_item', 'delete', { title: 'Bulletin 88', files: 2 }),
      ),
    ).toEqual({
      actionLabel: 'Deleted document',
      target: 'Bulletin 88',
    });
  });

  it('labels document review transitions and new versions', () => {
    expect(
      describeAuditEvent(
        event(
          'knowledge_item',
          'update',
          { transition: 'approve' },
          'Bulletin 88',
        ),
      ).actionLabel,
    ).toBe('Approved document');
    expect(
      describeAuditEvent(
        event('knowledge_item', 'update', { newVersion: 3 }, 'Bulletin 88'),
      ).target,
    ).toBe('Bulletin 88 · v3');
  });

  it('describes prompt publishing and tree imports', () => {
    expect(
      describeAuditEvent(
        event(
          'ai_prompt_version',
          'create',
          { versionNumber: 3, published: true },
          'v3',
        ),
      ),
    ).toEqual({
      actionLabel: 'Published prompt v3',
      target: 'AI configuration',
    });
    expect(
      describeAuditEvent(
        event(
          'machine_model',
          'update',
          { import: true, systemCount: 7 },
          'Hitachi EX3600',
        ),
      ).actionLabel,
    ).toBe('Imported system tree');
  });

  it('labels review queue moves by the new status', () => {
    const metadata = {
      before: { status: 'in_review' },
      after: { status: 'escalated' },
    };
    expect(
      describeAuditEvent(event('ai_review_item', 'update', metadata))
        .actionLabel,
    ).toBe('Escalated flagged answer');
    const notesOnly = {
      before: { status: 'in_review' },
      after: { status: 'in_review' },
    };
    expect(
      describeAuditEvent(event('ai_review_item', 'update', notesOnly))
        .actionLabel,
    ).toBe('Updated review notes');
  });
});

describe('labelEventType', () => {
  it('reads sensibly for event types it has no label for', () => {
    expect(labelEventType('fleet_group', 'update')).toBe('Updated fleet group');
    expect(labelEventType('fleet_group', 'create')).toBe('Created fleet group');
    expect(labelEventType('fleet_group', 'delete')).toBe('Deleted fleet group');
  });
});
