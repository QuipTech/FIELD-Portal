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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { MachineModelsService } from './machineModels.service';
import { ModelTreeService } from './modelTree.service';
import { ModelTreeImportService } from './modelTreeImport.service';
import { CreateMachineModelDto } from './dto/createMachineModelDto';
import { UpdateMachineModelDto } from './dto/updateMachineModelDto';
import { ListMachineModelsQueryDto } from './dto/listMachineModelsQueryDto';
import { TreeNodeNameDto } from './dto/treeNodeNameDto';
import { ImportModelTreeDto } from './dto/importModelTreeDto';

// The Machine library: the shared catalog every organisation builds from
// plus each organisation's own models. The Owner sees and changes every
// model.
@Controller('admin/machineModels')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class MachineModelsController {
  constructor(
    private readonly machineModelsService: MachineModelsService,
    private readonly modelTreeService: ModelTreeService,
    private readonly modelTreeImportService: ModelTreeImportService,
  ) {}

  @Get()
  list(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: ListMachineModelsQueryDto,
  ) {
    return this.machineModelsService.listModels(scope, query);
  }

  @Get(':modelId')
  get(
    @CurrentAdminScope() scope: AdminScope,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return this.machineModelsService.getModel(scope, modelId);
  }

  @Post()
  create(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMachineModelDto,
  ) {
    return this.machineModelsService.createModel(actor, scope, dto);
  }

  @Patch(':modelId')
  update(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: UpdateMachineModelDto,
  ) {
    return this.machineModelsService.updateModel(actor, scope, modelId, dto);
  }

  // Refused (409) while machines still use the model.
  @Delete(':modelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return this.machineModelsService.deleteModel(actor, scope, modelId);
  }

  @Get(':modelId/tree')
  getTree(
    @CurrentAdminScope() scope: AdminScope,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return this.modelTreeService.getTree(scope, modelId);
  }

  @Post(':modelId/systems')
  addSystem(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.addSystem(actor, scope, modelId, dto.name);
  }

  @Post(':modelId/tree/import')
  @HttpCode(HttpStatus.OK)
  importTree(
    @CurrentAdminScope() scope: AdminScope,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: ImportModelTreeDto,
  ) {
    return this.modelTreeImportService.importTree(actor, scope, modelId, dto);
  }
}
