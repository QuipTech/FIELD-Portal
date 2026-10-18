import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { KnowledgeBrandsService } from './knowledgeBrands.service';
import {
  KnowledgeBrandDto,
  KnowledgeCategoryDto,
} from './dto/knowledgeBrandDto';

@Controller('admin/knowledge/brands')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminKnowledgeBrandsController {
  constructor(private readonly brands: KnowledgeBrandsService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return this.brands.listBrands(actor);
  }
  @Get(':id') async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const brand = (await this.brands.listBrands(actor)).find(
      (item) => item.id === id,
    );
    if (!brand) throw new NotFoundException('Brand not found.');
    return brand;
  }
  @Post() create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: KnowledgeBrandDto,
  ) {
    return this.brands.saveBrand(actor, dto);
  }
  @Patch(':id') update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: KnowledgeBrandDto,
  ) {
    return this.brands.saveBrand(actor, dto, id);
  }
  @Delete(':id') remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.brands.remove(actor, 'brand', id);
  }
  @Get(':brandId/categories') categories(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
  ) {
    return this.brands.listCategories(actor, brandId);
  }
  @Post(':brandId/categories') createCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: KnowledgeCategoryDto,
  ) {
    return this.brands.saveCategory(actor, brandId, dto);
  }
  @Patch(':brandId/categories/:id') updateCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: KnowledgeCategoryDto,
  ) {
    return this.brands.saveCategory(actor, brandId, dto, id);
  }
  @Delete(':brandId/categories/:id') removeCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.brands.remove(actor, 'category', id, brandId);
  }
}
