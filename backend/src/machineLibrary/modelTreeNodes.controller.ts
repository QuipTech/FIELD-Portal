import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { ModelTreeService } from './modelTree.service';
import { TreeNodeNameDto } from './dto/treeNodeNameDto';

// Edits to one system or component of a model's tree, by anyone who may
// change that model (the Owner: any). Each route responds
// with the owning model's refreshed tree.
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class ModelTreeNodesController {
  constructor(private readonly modelTreeService: ModelTreeService) {}

  @Patch('modelSystems/:systemId')
  renameSystem(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.renameSystem(actor, scope, systemId, dto.name);
  }

  // Also removes the system's components.
  @Delete('modelSystems/:systemId')
  deleteSystem(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('systemId', ParseUUIDPipe) systemId: string,
  ) {
    return this.modelTreeService.deleteSystem(actor, scope, systemId);
  }

  @Post('modelSystems/:systemId/components')
  addComponent(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.addComponent(actor, scope, systemId, dto.name);
  }

  @Patch('modelComponents/:componentId')
  renameComponent(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.renameComponent(
      actor,
      scope,
      componentId,
      dto.name,
    );
  }

  @Delete('modelComponents/:componentId')
  deleteComponent(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('componentId', ParseUUIDPipe) componentId: string,
  ) {
    return this.modelTreeService.deleteComponent(actor, scope, componentId);
  }
}
