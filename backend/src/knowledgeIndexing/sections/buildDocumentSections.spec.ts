import { TextBlock } from '../extraction/documentBlocks';
import { buildDocumentSections } from './buildDocumentSections';

const heading = (text: string, page: number | null = 1): TextBlock => ({
  page,
  text,
  isHeading: true,
});
const body = (text: string, page: number | null = 1): TextBlock => ({
  page,
  text,
  isHeading: false,
});

const DOCUMENT = {
  title: 'CAT 793F Hydraulic System Maintenance Bulletin',
  fileName: 'CAT_793F_Hydraulic_System_Maintenance_Bulletin (2).pdf',
};

describe('buildDocumentSections', () => {
  it('makes one section per heading, in order, with its start page', () => {
    const sections = buildDocumentSections(
      [
        heading('1. Purpose'),
        body('Covers hoist pressure loss.'),
        heading('2. Symptoms', 2),
        body('Slow raise.', 2),
      ],
      DOCUMENT,
    );
    expect(
      sections.map(({ ordinal, heading: title, page, content }) => ({
        ordinal,
        title,
        page,
        content,
      })),
    ).toEqual([
      {
        ordinal: 0,
        title: '1. Purpose',
        page: 1,
        content: 'Covers hoist pressure loss.',
      },
      { ordinal: 1, title: '2. Symptoms', page: 2, content: 'Slow raise.' },
    ]);
  });

  it('strips a title block at the top that repeats the title or file name', () => {
    const sections = buildDocumentSections(
      [
        heading('Caterpillar 793F Off-Highway Truck'),
        body('Hydraulic System Maintenance Bulletin — MB-793F-2026-014'),
        heading('1. Purpose'),
        body('Covers hoist pressure loss.'),
      ],
      DOCUMENT,
    );
    expect(sections.map((section) => section.heading)).toEqual(['1. Purpose']);
  });

  it('keeps an opening section that is real content, with no heading', () => {
    const intro = 'Read every safety note before servicing the suspension. '
      .repeat(8)
      .trim();
    const sections = buildDocumentSections(
      [body(intro), heading('1. Tools'), body('Torque wrench.')],
      DOCUMENT,
    );
    expect(sections[0]).toMatchObject({ heading: null, content: intro });
  });

  it('drops headings with nothing under them', () => {
    const sections = buildDocumentSections(
      [
        heading('1. Purpose'),
        body('Text.'),
        heading('Chapter 2'),
        heading('2.1 Pump'),
        body('Pump text.'),
      ],
      DOCUMENT,
    );
    expect(sections.map((section) => section.heading)).toEqual([
      '1. Purpose',
      '2.1 Pump',
    ]);
  });

  it('takes figure captions out of the text as figures', () => {
    const [section] = buildDocumentSections(
      [
        heading('1. Purpose'),
        body('See the layout.\nFigure 3 – Hoist circuit\nThen bleed.', 4),
      ],
      DOCUMENT,
    );
    expect(section.figures).toEqual([
      { page: 4, caption: 'Figure 3 – Hoist circuit' },
    ]);
    expect(section.content).toBe('See the layout.\n\nThen bleed.');
  });
});
