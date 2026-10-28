import { LoadedSection } from '../../knowledgeArticle/loadArticleSections';
import { toSectionRef } from '../catalogDocumentMapper';
import { PageSectionRef } from '../types/catalogDocumentResponse';

// The sections a page shows: those starting on it, preceded by the one
// that started earlier and may run onto it (sections are in reading order;
// where exactly it ends isn't recorded, so it's always included).
export const findPageSections = (
  sections: LoadedSection[],
  page: number,
): { section: LoadedSection; ref: PageSectionRef }[] => {
  const startingHere = sections.filter((section) => section.page === page);
  const runningOn = sections
    .filter((section) => section.page !== null && section.page < page)
    .pop();
  return [
    ...(runningOn ? [{ section: runningOn, startsOnPage: false }] : []),
    ...startingHere.map((section) => ({ section, startsOnPage: true })),
  ].map(({ section, startsOnPage }) => ({
    section,
    ref: { ...toSectionRef(section), startsOnPage },
  }));
};

// Page text for versions without saved pages: the sections that start on
// the page, or the one running through it when none do.
export const toSectionsText = (
  pageSections: { section: LoadedSection; ref: PageSectionRef }[],
): string => {
  const starting = pageSections.filter((entry) => entry.ref.startsOnPage);
  const shown = starting.length ? starting : pageSections;
  return shown
    .map(({ section }) =>
      [section.heading, section.content].filter(Boolean).join('\n\n'),
    )
    .join('\n\n');
};
