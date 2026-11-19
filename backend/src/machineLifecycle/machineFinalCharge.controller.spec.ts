import { MachineLifecycleController } from './machineLifecycle.controller';
import { MachineDeletionService } from './machineDeletion.service';
import { MachineLifecycleService } from './machineLifecycle.service';
import { MachineTransfersService } from './transfers/machineTransfers.service';
import { ActivationQuoteService } from './activationQuote.service';
import { PromoCodesService } from '../billing/discounts/promoCodes.service';

const actor = { userId: 'user-a', tenantId: 'tenant-a', email: 'a@b.c' };
const MACHINE_ID = '46eab22d-9761-42a9-87ae-a0b15f91ed11';

const setup = () => {
  const deletion = {
    payFinalCharge: jest.fn().mockResolvedValue({ paymentSheet: null }),
  };
  const promoCodes = {
    findCurrentForOrganisation: jest.fn().mockResolvedValue(null),
    validate: jest.fn().mockResolvedValue({ code: 'SAVE9' }),
    redeem: jest.fn().mockResolvedValue({ code: 'SAVE9' }),
  };
  const controller = new MachineLifecycleController(
    {} as MachineLifecycleService,
    {} as MachineTransfersService,
    {} as ActivationQuoteService,
    deletion as unknown as MachineDeletionService,
    promoCodes as unknown as PromoCodesService,
  );
  return { controller, deletion, promoCodes };
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

describe('activation promo codes (machine.lifecycle)', () => {
  it("checks and applies a code for the caller's organisation", async () => {
    const { controller, promoCodes } = setup();
    await controller.currentActivationPromo(actor);
    await controller.validateActivationPromo(actor, { code: 'save9' });
    await controller.redeemActivationPromo(actor, { code: 'save9' });
    expect(promoCodes.findCurrentForOrganisation).toHaveBeenCalledWith(actor);
    expect(promoCodes.validate).toHaveBeenCalledWith(actor, 'save9');
    expect(promoCodes.redeem).toHaveBeenCalledWith(actor, 'save9');
  });
});
