import { resolveRecipients } from './resolveRecipients';
import { buildCandidate, ORG_A, ORG_B } from './alertTestFixtures';

describe('resolveRecipients', () => {
  const supervisor = buildCandidate({ userId: 'sup' });
  const customer = buildCandidate({ userId: 'cust', roleNames: ['Customer'] });
  const technician = buildCandidate({
    userId: 'tech',
    roleNames: ['Field Technician'],
    hasWorkedOnMachine: true,
  });
  const assignee = buildCandidate({
    userId: 'assignee',
    roleNames: ['Field Technician'],
    isCaseAssignee: true,
  });
  const knowledgeManager = buildCandidate({
    userId: 'km',
    roleNames: ['Knowledge Manager'],
  });
  const candidates = [
    supervisor,
    customer,
    technician,
    assignee,
    knowledgeManager,
  ];

  it('maps each audience to people', () => {
    const ids = (audience: Parameters<typeof resolveRecipients>[0][number]) =>
      resolveRecipients([audience], candidates, ORG_A).map((c) => c.userId);
    expect(ids('site_supervisors')).toEqual(['sup']);
    expect(ids('admins')).toEqual(['cust']);
    expect(ids('assigned_technician')).toEqual(['tech', 'assignee']);
    expect(ids('ai_reviewers')).toEqual(['km']);
  });

  it('lists someone in several audiences once', () => {
    const both = buildCandidate({
      roleNames: ['Customer', 'Technical Manager'],
    });
    expect(
      resolveRecipients(['admins', 'site_supervisors'], [both, both], ORG_A),
    ).toHaveLength(1);
  });

  it('never returns people from another organisation', () => {
    const outsider = buildCandidate({ userId: 'outsider', tenantId: ORG_B });
    const result = resolveRecipients(
      ['site_supervisors'],
      [outsider, supervisor],
      ORG_A,
    );
    expect(result.map((c) => c.userId)).toEqual(['sup']);
  });
});
