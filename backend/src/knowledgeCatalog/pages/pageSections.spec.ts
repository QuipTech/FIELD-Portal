import { LoadedSection } from '../../knowledgeArticle/loadArticleSections';
import { findPageSections, toSectionsText } from './pageSections';

const section = (
  ordinal: number,
  heading: string,
  page: number,
): LoadedSection => ({
  ordinal,
  heading,
  page,
  content: `Body of ${heading}`,
  figures: [],
});

const SECTIONS = [
  section(0, '4.2 Filters', 3),
  section(1, '4.3 Hydraulic pump', 5),
  section(2, '4.4 Relief valve', 5),
];

describe('findPageSections', () => {
  it('lists the section running on, then those starting on the page', () => {
    expect(findPageSections(SECTIONS, 5).map((entry) => entry.ref)).toEqual([
      {
        sectionId: '4.2',
        anchor: 's0',
        heading: '4.2 Filters',
        page: 3,
        startsOnPage: false,
      },
      {
        sectionId: '4.3',
        anchor: 's1',
        heading: '4.3 Hydraulic pump',
        page: 5,
        startsOnPage: true,
      },
      {
        sectionId: '4.4',
        anchor: 's2',
        heading: '4.4 Relief valve',
        page: 5,
        startsOnPage: true,
      },
    ]);
  });

  it('gives the running section alone for a page with no headings', () => {
    expect(
      findPageSections(SECTIONS, 4).map((entry) => entry.ref.sectionId),
    ).toEqual(['4.2']);
  });
});

describe('toSectionsText', () => {
  it('uses the sections starting on the page when there are any', () => {
    expect(toSectionsText(findPageSections(SECTIONS, 5))).toBe(
      '4.3 Hydraulic pump\n\nBody of 4.3 Hydraulic pump\n\n4.4 Relief valve\n\nBody of 4.4 Relief valve',
    );
  });

  it('falls back to the running section', () => {
    expect(toSectionsText(findPageSections(SECTIONS, 4))).toBe(
      '4.2 Filters\n\nBody of 4.2 Filters',
    );
  });
});
