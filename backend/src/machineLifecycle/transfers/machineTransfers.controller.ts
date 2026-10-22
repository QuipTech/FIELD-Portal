import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import {
  ListTransfersQueryDto,
  RequestTransferDto,
  TransferDecisionDto,
} from '../dto/transferDtos';
import { MACHINE_LIFECYCLE_PERMISSION } from '../lifecycleTransitions';
import { MachineTransfersService } from './machineTransfers.service';
import { MachineTransferApprovalService } from './machineTransferApproval.service';

// Transfer requests (owning organisation) and the approvals inbox
// (receiving organisation). Every route needs machine.lifecycle.
@Controller()
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
export class MachineTransfersController {
  constructor(
    private readonly transfersService: MachineTransfersService,
    private readonly approvalService: MachineTransferApprovalService,
  ) {}

  @Post('machines/:machineId/transfers')
  request(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: RequestTransferDto,
  ) {
    return this.transfersService.requestTransfer(actor, machineId, dto);
  }

  @Get('machine-transfers')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListTransfersQueryDto,
  ) {
    return this.transfersService.listTransfers(actor, query.direction);
  }

  @Post('machine-transfers/:transferId/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() dto: TransferDecisionDto,
  ) {
    return this.approvalService.approveTransfer(
      actor,
      transferId,
      dto.note ?? null,
    );
  }

  @Post('machine-transfers/:transferId/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() dto: TransferDecisionDto,
  ) {
    return this.transfersService.rejectTransfer(
      actor,
      transferId,
      dto.note ?? null,
    );
  }

  @Post('machine-transfers/:transferId/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() dto: TransferDecisionDto,
  ) {
    return this.transfersService.cancelTransfer(
      actor,
      transferId,
      dto.note ?? null,
    );
  }
}
