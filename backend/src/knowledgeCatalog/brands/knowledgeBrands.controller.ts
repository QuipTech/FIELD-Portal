import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { KnowledgeBrandsService } from './knowledgeBrands.service';

// The app's Knowledge home: brands in the organisation's plan, then each
// brand's categories and models. Any signed-in user.
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeBrandsController {
  constructor(private readonly knowledgeBrands: KnowledgeBrandsService) {}

  @Get('brands')
  listBrands(@CurrentUser() actor: AuthenticatedUser) {
    return this.knowledgeBrands.listBrands(actor);
  }

  @Get('brands/:brandId')
  getBrand(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
  ) {
    return this.knowledgeBrands.getBrand(actor, brandId);
  }

  @Get('categories/:categoryId')
  getCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.knowledgeBrands.getCategory(actor, categoryId);
  }
}
