import { PoolClient } from 'pg';
import { blocksFromChunks } from '../knowledgeIndexing/sections/blocksFromChunks';
import { buildDocumentSections } from '../knowledgeIndexing/sections/buildDocumentSections';
import { toSectionPayloads } from '../knowledgeIndexing/sections/documentSections.repository';
import * as articleRepository from './knowledgeArticle.repository';

export interface LoadedFigure {
  page: number | null;
  caption: string;
  imageStorageKey: string | null;
}

export interface LoadedSection {
  ordinal: number;
  heading: string | null;
  page: number | null;
  content: string;
  figures: LoadedFigure[];
}

// A live version's sections: the ones saved while indexing, or — for a
// version indexed before sections were saved — rebuilt from its chunks
// and saved now, so later searches can point at them too.
export const loadArticleSections = async (
  client: PoolClient,
  version: { id: string; title: string; fileName: string | null },
): Promise<LoadedSection[]> => {
  const stored = await articleRepository.listStoredSections(client, version.id);
  if (stored.length) {
    const figures = await articleRepository.listStoredFigures(
      client,
      version.id,
    );
    return stored.map((row) => ({
      ordinal: row.ordinal,
      heading: row.heading,
      page: row.page_number,
      content: row.content,
      figures: figures
        .filter((figure) => figure.section_ordinal === row.ordinal)
        .map((figure) => ({
          page: figure.page_number,
          caption: figure.caption,
          imageStorageKey: figure.image_storage_key,
        })),
    }));
  }
  const chunks = await articleRepository.listVersionChunks(client, version.id);
  const rebuilt = buildDocumentSections(blocksFromChunks(chunks), {
    title: version.title,
    fileName: version.fileName,
  });
  if (rebuilt.length) {
    await articleRepository.backfillSections(client, {
      versionId: version.id,
      ...toSectionPayloads(rebuilt),
    });
  }
  return rebuilt.map((section) => ({
    ...section,
    figures: section.figures.map((figure) => ({
      ...figure,
      imageStorageKey: null,
    })),
  }));
};
