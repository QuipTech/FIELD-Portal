import { toParagraphs } from './toParagraphs';

describe('toParagraphs', () => {
  it('joins wrapped lines into one paragraph', () => {
    expect(
      toParagraphs([
        'This bulletin covers diagnosis of',
        'pressure loss on CAT 793F trucks.',
      ]),
    ).toBe(
      'This bulletin covers diagnosis of pressure loss on CAT 793F trucks.',
    );
  });

  it('starts a new paragraph after a sentence end', () => {
    expect(toParagraphs(['First sentence.', 'Second one.'])).toBe(
      'First sentence.\n\nSecond one.',
    );
  });

  it('keeps a wrapped bullet together and each bullet and table row apart', () => {
    expect(
      toParagraphs([
        '• Dump body raises slower than normal, or fails to reach full raise angle within the',
        'expected cycle time.',
        '• Pump whines under load.',
        '1 Confirm tank level Level within band',
        '2 Check relief valve 2850 PSI',
      ]),
    ).toBe(
      [
        '• Dump body raises slower than normal, or fails to reach full raise angle within the expected cycle time.',
        '• Pump whines under load.',
        '1 Confirm tank level Level within band',
        '2 Check relief valve 2850 PSI',
      ].join('\n\n'),
    );
  });
});
