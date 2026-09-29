import { resolveReviewAssignment } from './reviewQueueRules';

describe('resolveReviewAssignment', () => {
  it('claims an unassigned item for the actor when picked up', () => {
    expect(
      resolveReviewAssignment(
        { status: 'unreviewed', reviewerId: null },
        'in_review',
        'me',
      ),
    ).toEqual({ status: 'in_review', reviewerId: 'me' });
  });

  it('keeps the existing reviewer when someone else resolves it', () => {
    expect(
      resolveReviewAssignment(
        { status: 'in_review', reviewerId: 'ak' },
        'resolved',
        'me',
      ),
    ).toEqual({ status: 'resolved', reviewerId: 'ak' });
  });

  it('releases the reviewer when sent back to unreviewed', () => {
    expect(
      resolveReviewAssignment(
        { status: 'in_review', reviewerId: 'ak' },
        'unreviewed',
        'me',
      ),
    ).toEqual({ status: 'unreviewed', reviewerId: null });
  });

  it('leaves status and reviewer alone for a notes-only change', () => {
    expect(
      resolveReviewAssignment(
        { status: 'escalated', reviewerId: 'ak' },
        undefined,
        'me',
      ),
    ).toEqual({ status: 'escalated', reviewerId: 'ak' });
  });
});
