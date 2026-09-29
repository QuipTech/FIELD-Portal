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
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { MachineModelsService } from './machineModels.service';
import { ModelTreeService } from './modelTree.service';
import { ModelTreeImportService } from './modelTreeImport.service';
import { CreateMachineModelDto } from './dto/createMachineModelDto';
import { UpdateMachineModelDto } from './dto/updateMachineModelDto';
import { ListMachineModelsQueryDto } from './dto/listMachineModelsQueryDto';
import { TreeNodeNameDto } from './dto/treeNodeNameDto';
import { ImportModelTreeDto } from './dto/importModelTreeDto';

// The shared machine library every organisation's machines are built
// from — Owner only.
@Controller('admin/machineModels')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class MachineModelsController {
  constructor(
    private readonly machineModelsService: MachineModelsService,
    private readonly modelTreeService: ModelTreeService,
    private readonly modelTreeImportService: ModelTreeImportService,
  ) {}

  @Get()
  list(@Query() query: ListMachineModelsQueryDto) {
    return this.machineModelsService.listModels(query);
  }

  @Get(':modelId')
  get(@Param('modelId', ParseUUIDPipe) modelId: string) {
    return this.machineModelsService.getModel(modelId);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMachineModelDto,
  ) {
    return this.machineModelsService.createModel(actor, dto);
  }

  @Patch(':modelId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: UpdateMachineModelDto,
  ) {
    return this.machineModelsService.updateModel(actor, modelId, dto);
  }

  // Refused (409) while machines still use the model.
  @Delete(':modelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return this.machineModelsService.deleteModel(actor, modelId);
  }

  @Get(':modelId/tree')
  getTree(@Param('modelId', ParseUUIDPipe) modelId: string) {
    return this.modelTreeService.getTree(modelId);
  }

  @Post(':modelId/systems')
  addSystem(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: TreeNodeNameDto,
  ) {
    return this.modelTreeService.addSystem(actor, modelId, dto.name);
  }

  @Post(':modelId/tree/import')
  @HttpCode(HttpStatus.OK)
  importTree(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: ImportModelTreeDto,
  ) {
    return this.modelTreeImportService.importTree(actor, modelId, dto);
  }
}
