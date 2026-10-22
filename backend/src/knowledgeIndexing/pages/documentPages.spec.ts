import { buildDocumentPages } from './documentPages';

describe('buildDocumentPages', () => {
  it('groups blocks by page in page order', () => {
    expect(
      buildDocumentPages([
        { page: 2, text: '4.3 Hydraulic pump', isHeading: true },
        { page: 1, text: 'Introduction', isHeading: false },
        { page: 2, text: 'Check the relief valve.', isHeading: false },
      ]),
    ).toEqual([
      { page: 1, content: 'Introduction' },
      { page: 2, content: '4.3 Hydraulic pump\nCheck the relief valve.' },
    ]);
  });

  it('skips blocks without a page and blank text', () => {
    expect(
      buildDocumentPages([
        { page: null, text: 'DOCX body', isHeading: false },
        { page: 3, text: '   ', isHeading: false },
      ]),
    ).toEqual([]);
  });
});
