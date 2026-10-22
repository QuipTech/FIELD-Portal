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
import { CatalogBrandsService } from './catalogBrands.service';

// One brand or category with its categories, models and document types,
// for the app's Knowledge home. Any signed-in user.
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class CatalogBrandsController {
  constructor(private readonly catalogBrands: CatalogBrandsService) {}

  @Get('brands/:brandId')
  getBrand(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
  ) {
    return this.catalogBrands.getBrand(actor, brandId);
  }

  @Get('categories/:categoryId')
  getCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.catalogBrands.getCategory(actor, categoryId);
  }
}
