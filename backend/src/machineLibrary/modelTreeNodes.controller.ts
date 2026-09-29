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
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { ModelTreeService } from './modelTree.service';
import { TreeNodeNameDto } from './dto/treeNodeNameDto';

// Edits to one system or component of a model's tree — Owner only. Each
// route responds with the owning model's refreshed tree.
@Controller('admin')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class ModelTreeNodesController {
  constructor(private readonly modelTreeService: ModelTreeService) {}

  @Patch('modelSystems/:systemId')
  renameSystem(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.renameSystem(actor, systemId, dto.name);
  }

  // Also removes the system's components.
  @Delete('modelSystems/:systemId')
  deleteSystem(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('systemId', ParseUUIDPipe) systemId: string,
  ) {
    return this.modelTreeService.deleteSystem(actor, systemId);
  }

  @Post('modelSystems/:systemId/components')
  addComponent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('systemId', ParseUUIDPipe) systemId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.addComponent(actor, systemId, dto.name);
  }

  @Patch('modelComponents/:componentId')
  renameComponent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.renameComponent(actor, componentId, dto.name);
  }

  @Delete('modelComponents/:componentId')
  deleteComponent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('componentId', ParseUUIDPipe) componentId: string,
  ) {
    return this.modelTreeService.deleteComponent(actor, componentId);
  }
}
