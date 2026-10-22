import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { AdminScopeGuard } from '../../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { KNOWLEDGE_ADMIN_PERMISSION } from '../access/knowledgeAccess';
import {
  CreateCategoryDto,
  SetBrandAccessDto,
  UpdateCategoryDto,
} from '../dto/knowledgeTaxonomyDtos';
import { BrandAccessService } from './brandAccess.service';
import { KnowledgeTaxonomyService } from './knowledgeTaxonomy.service';

// Brand access and categories. Organisation admins (knowledge.publish) can
// read their own brand access; changing a plan's brands or the shared
// category list is for platform admins (AdminScopeGuard: platform.manage).
@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(KNOWLEDGE_ADMIN_PERMISSION)
export class AdminKnowledgeTaxonomyController {
  constructor(
    private readonly brandAccess: BrandAccessService,
    private readonly taxonomy: KnowledgeTaxonomyService,
  ) {}

  @Get('brand-access')
  getBrandAccess(@CurrentUser() actor: AuthenticatedUser) {
    return this.brandAccess.getOwn(actor);
  }

  @Put('brand-access/:tenantId')
  @UseGuards(AdminScopeGuard)
  setBrandAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetBrandAccessDto,
  ) {
    return this.brandAccess.setForTenant(actor, tenantId, dto);
  }

  @Post('categories')
  @UseGuards(AdminScopeGuard)
  createCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.taxonomy.createCategory(actor, dto);
  }

  @Patch('categories/:categoryId')
  @UseGuards(AdminScopeGuard)
  updateCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.taxonomy.updateCategory(actor, categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @UseGuards(AdminScopeGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.taxonomy.deleteCategory(actor, categoryId);
  }
}
