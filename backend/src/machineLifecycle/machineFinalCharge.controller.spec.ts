import { MachineLifecycleController } from './machineLifecycle.controller';
import { MachineDeletionService } from './machineDeletion.service';
import { MachineLifecycleService } from './machineLifecycle.service';
import { MachineTransfersService } from './transfers/machineTransfers.service';
import { ActivationQuoteService } from './activationQuote.service';

const actor = { userId: 'user-a', tenantId: 'tenant-a', email: 'a@b.c' };
const MACHINE_ID = '46eab22d-9761-42a9-87ae-a0b15f91ed11';

const setup = () => {
  const deletion = {
    payFinalCharge: jest.fn().mockResolvedValue({ paymentSheet: null }),
  };
  const controller = new MachineLifecycleController(
    {} as MachineLifecycleService,
    {} as MachineTransfersService,
    {} as ActivationQuoteService,
    deletion as unknown as MachineDeletionService,
  );
  return { controller, deletion };
};

describe('POST /machines/:id/final-charge client', () => {
  it.each([
    ['web', false],
    ['mobile', true],
    [undefined, true],
    ['something-else', true],
  ])(
    'X-Field-Client %s pays in the Payment Sheet: %s',
    async (client, inApp) => {
      const { controller, deletion } = setup();
      await controller.payFinalCharge(actor, MACHINE_ID, {}, client);
      expect(deletion.payFinalCharge).toHaveBeenCalledWith(
        actor,
        MACHINE_ID,
        `http://localhost:3001/machines/${MACHINE_ID}`,
        undefined,
        { inApp },
      );
    },
  );
});
