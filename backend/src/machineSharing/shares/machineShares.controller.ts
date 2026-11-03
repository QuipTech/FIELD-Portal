import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ORGANISATION_ADMIN_PERMISSION } from '../access/machineScope';
import { MachineSharesService } from './machineShares.service';
import { RevokeShareDto } from '../dto/machineGroupDtos';

// Machine detail → Sharing, for the owning organisation's admins. Another
// organisation's machine, or one shared with the caller, is a 404.
@Controller('machines/:machineId/shares')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(ORGANISATION_ADMIN_PERMISSION)
export class MachineSharesController {
  constructor(private readonly shares: MachineSharesService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.shares.listShares(actor, machineId);
  }

  // Returns the shares as they are now.
  @Delete(':assignmentId')
  withdraw(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: RevokeShareDto,
  ) {
    return this.shares.withdrawShare(
      actor,
      { machineId, assignmentId },
      dto.reason,
    );
  }
}
