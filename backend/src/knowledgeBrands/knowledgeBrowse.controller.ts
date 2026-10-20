import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeBrandsService } from './knowledgeBrands.service';
import { KnowledgeLibraryService } from '../knowledgeLibrary/knowledgeLibrary.service';
import { KnowledgeArticleService } from '../knowledgeArticle/knowledgeArticle.service';
import { SearchKnowledgeLibraryQueryDto } from '../knowledgeLibrary/dto/searchKnowledgeLibraryQueryDto';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeBrowseController {
  constructor(
    private readonly brands: KnowledgeBrandsService,
    private readonly library: KnowledgeLibraryService,
    private readonly articles: KnowledgeArticleService,
  ) {}
  @Get('models') models(@CurrentUser() actor: AuthenticatedUser) {
    return this.brands.listModels(actor);
  }
  @Get('brands') listBrands(@CurrentUser() actor: AuthenticatedUser) {
    return this.brands.listBrands(actor);
  }
  // Every accessible brand's categories at once, so clients can preload them.
  @Get('categories') allCategories(@CurrentUser() actor: AuthenticatedUser) {
    return this.brands.listAllCategories(actor);
  }
  @Get('brands/:brandId/categories') categories(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) id: string,
  ) {
    return this.brands.listCategories(actor, id);
  }
  @Get('documents') list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filters: SearchKnowledgeLibraryQueryDto,
  ) {
    return this.library.search(actor, filters);
  }
  @Get('documents/:id') detail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.articles.getArticle(actor, id);
  }
  @Get('search') search(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() filters: SearchKnowledgeLibraryQueryDto,
  ) {
    return this.library.search(actor, filters);
  }
}
