import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { CatalogFacetsQueryDto } from '../dto/catalogFacetsQueryDto';
import { SearchCatalogQueryDto } from '../dto/searchCatalogQueryDto';
import { DocumentPagesService } from '../pages/documentPages.service';
import { CatalogSearchService } from '../search/catalogSearch.service';
import { CatalogDocumentsService } from './catalogDocuments.service';

// The app's reader: page-level search, facets, a document's contents, its
// pages and its file. Non-admins only ever see live documents; anything the
// caller can't read is 404 (catalogDocumentAccess.ts). Listing documents
// and their detail are GET /knowledge/documents[/:id] (knowledgeBrands).
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class CatalogDocumentsController {
  constructor(
    private readonly documents: CatalogDocumentsService,
    private readonly pages: DocumentPagesService,
    private readonly search: CatalogSearchService,
  ) {}

  @Get('search/pages')
  searchPages(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SearchCatalogQueryDto,
  ) {
    return this.search.search(actor, query);
  }

  @Get('facets')
  facets(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: CatalogFacetsQueryDto,
  ) {
    return this.search.getFacets(actor, query);
  }

  @Get('documents/:documentId/contents')
  contents(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.getContents(actor, documentId);
  }

  @Get('documents/:documentId/pages/:page')
  page(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('page', ParseIntPipe) page: number,
  ) {
    return this.pages.getPage(actor, documentId, page);
  }

  @Get('documents/:documentId/file')
  file(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.getFile(actor, documentId);
  }
}
