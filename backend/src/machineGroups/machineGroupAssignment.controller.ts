import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { DatabaseService } from '../database/database.service';
import { ORGANISATION_ADMIN_PERMISSION } from './access/machineScope';
import { BulkAssignGroupDto } from './dto/machineAccessDtos';
import { moveMachinesToGroup, MoveResult } from './moveMachinesToGroup';

// Machines list → select → "Move to group". Organisation admins only; one
// machine's group can also be set with PATCH /machines/:machineId.
@Controller('machines')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(ORGANISATION_ADMIN_PERMISSION)
export class MachineGroupAssignmentController {
  constructor(private readonly databaseService: DatabaseService) {}

  // All or nothing: an unknown machine id is a 404 and nothing moves.
  @Post('bulk-assign-group')
  bulkAssign(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BulkAssignGroupDto,
  ): Promise<MoveResult> {
    return this.databaseService.withActor(actor, (client) =>
      moveMachinesToGroup(client, actor, dto),
    );
  }
}
