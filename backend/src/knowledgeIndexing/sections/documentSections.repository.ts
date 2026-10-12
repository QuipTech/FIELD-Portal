import { DatabaseService } from '../../database/database.service';
import { DocumentSection } from './documentSection';

// The JSON the section-writing functions take (migration 0076).
export const toSectionPayloads = (
  sections: DocumentSection[],
): { sections: string; figures: string } => ({
  sections: JSON.stringify(
    sections.map(({ ordinal, heading, page, content }) => ({
      ordinal,
      heading,
      page,
      content,
    })),
  ),
  figures: JSON.stringify(
    sections
      .flatMap((section) =>
        section.figures.map((figure) => ({
          ...figure,
          sectionOrdinal: section.ordinal,
        })),
      )
      .map((figure, ordinal) => ({ ...figure, ordinal })),
  ),
});

// Saves a version's sections and figures while it's being indexed, via
// SECURITY DEFINER replace_document_sections(), like the chunks.
// Re-indexing a version replaces what an earlier run saved.
export const replaceDocumentSections = async (
  databaseService: DatabaseService,
  versionId: string,
  sections: DocumentSection[],
): Promise<void> => {
  const payloads = toSectionPayloads(sections);
  await databaseService.query('SELECT replace_document_sections($1, $2, $3)', [
    versionId,
    payloads.sections,
    payloads.figures,
  ]);
};
