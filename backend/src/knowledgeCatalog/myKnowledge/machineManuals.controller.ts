import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';
import { MyKnowledgeService } from './myKnowledge.service';

// A machine's Manuals tab: live documents linked to its model that the
// caller may open. 404 for a machine outside the caller's organisation.
@Controller('machines/:machineId/manuals')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineManualsController {
  constructor(private readonly myKnowledge: MyKnowledgeService) {}

  @Get()
  @RequirePermissions('machine.view')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.myKnowledge.listMachineManuals(actor, machineId, query);
  }
}
