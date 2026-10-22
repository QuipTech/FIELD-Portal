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
import { ListCatalogDocumentsQueryDto } from '../dto/listCatalogDocumentsQueryDto';
import { SearchCatalogQueryDto } from '../dto/searchCatalogQueryDto';
import { DocumentPagesService } from '../pages/documentPages.service';
import { CatalogSearchService } from '../search/catalogSearch.service';
import { CatalogDocumentsService } from './catalogDocuments.service';

// Browsing, searching and reading documents. Non-admins only ever see live
// documents; a brand outside the plan is hidden from lists and 403 when
// opened directly (catalogDocumentAccess.ts).
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class CatalogDocumentsController {
  constructor(
    private readonly documents: CatalogDocumentsService,
    private readonly pages: DocumentPagesService,
    private readonly search: CatalogSearchService,
  ) {}

  @Get('documents')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCatalogDocumentsQueryDto,
  ) {
    return this.documents.list(actor, query);
  }

  @Get('search')
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

  @Get('documents/:documentId')
  detail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.getDetail(actor, documentId);
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
