import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { toSectionId } from '../../knowledge/sectionId';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { toCatalogDocument, toTotal } from '../catalogDocumentMapper';
import { CatalogFacetsQueryDto } from '../dto/catalogFacetsQueryDto';
import { SearchCatalogQueryDto } from '../dto/searchCatalogQueryDto';
import { loadCatalogFacets } from '../facets/loadCatalogFacets';
import {
  CatalogDocument,
  CatalogFacets,
  Paged,
} from '../types/catalogResponse';
import { searchCatalogPages } from './catalogSearch.repository';

export interface CatalogSearchHit {
  document: CatalogDocument;
  // null for formats without pages (DOCX).
  page: number | null;
  // "4.3", or `s{ordinal}` for an unnumbered heading; null if unknown.
  sectionId: string | null;
  heading: string | null;
  // Matched words wrapped in <mark>…</mark>; everything else is plain text.
  snippet: string;
}

@Injectable()
export class CatalogSearchService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  search = async (
    actor: AuthenticatedUser,
    query: SearchCatalogQueryDto,
  ): Promise<Paged<CatalogSearchHit>> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => searchCatalogPages(client, access, query),
    );
    return {
      items: rows.map((row) => ({
        document: toCatalogDocument(row, access),
        page: row.hit_page,
        sectionId:
          row.section_ordinal === null
            ? null
            : toSectionId(row.section_ordinal, row.section_heading),
        heading: row.section_heading,
        snippet: row.snippet,
      })),
      total: toTotal(rows),
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  getFacets = async (
    actor: AuthenticatedUser,
    query: CatalogFacetsQueryDto,
  ): Promise<CatalogFacets> => {
    const access = await this.knowledgeAccess.resolve(actor);
    return this.databaseService.withTenant(actor.tenantId, (client) =>
      loadCatalogFacets(client, access, query),
    );
  };
}
