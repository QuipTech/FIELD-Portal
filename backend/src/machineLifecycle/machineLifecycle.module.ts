import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { EnterpriseThresholdService } from './enterpriseThreshold.service';
import { MachineLifecycleController } from './machineLifecycle.controller';
import { MachineLifecycleService } from './machineLifecycle.service';
import { MachineTransfersController } from './transfers/machineTransfers.controller';
import { MachineTransferApprovalService } from './transfers/machineTransferApproval.service';
import { MachineTransfersService } from './transfers/machineTransfers.service';

// Machine lifecycle and activation (billing spec section 4): what decides
// whether a machine is billed, and transfers between organisations.
@Module({
  imports: [BillingModule],
  controllers: [MachineLifecycleController, MachineTransfersController],
  providers: [
    MachineLifecycleService,
    MachineTransfersService,
    MachineTransferApprovalService,
    EnterpriseThresholdService,
  ],
})
export class MachineLifecycleModule {}
