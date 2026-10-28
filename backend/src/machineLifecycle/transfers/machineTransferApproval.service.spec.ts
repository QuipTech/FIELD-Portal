import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingConfigService } from '../../billing/billingConfig/billingConfig.service';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import * as transfersRepository from './machineTransfers.repository';
import { MachineTransferApprovalService } from './machineTransferApproval.service';
import { MachineTransfersService } from './machineTransfers.service';

jest.mock('./machineTransfers.repository', () => ({
  lockTransfer: jest.fn(),
  findSellerActivation: jest.fn(),
  completeMachineTransfer: jest.fn(),
  recordTransferDecision: jest.fn(),
}));

const buyer = { userId: 'buyer-admin', tenantId: 'tenant-b', email: 'b@x.au' };
const pending = {
  id: 'transfer-1',
  machine_id: 'machine-1',
  from_tenant_id: 'tenant-a',
  to_tenant_id: 'tenant-b',
  status: 'requested' as const,
};

const setup = () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const database = {
    transaction: async (work: (input: typeof client) => unknown) =>
      work(client),
  };
  const transfers = {
    listTransfers: jest
      .fn()
      .mockResolvedValue([{ id: 'transfer-1', status: 'completed' }]),
  };
  jest.mocked(transfersRepository.lockTransfer).mockResolvedValue(pending);
  jest.mocked(transfersRepository.findSellerActivation).mockResolvedValue({
    billing_account_id: 'account-a',
    timezone: 'Australia/Brisbane',
  });
  jest
    .mocked(transfersRepository.completeMachineTransfer)
    .mockResolvedValue(true);
  const service = new MachineTransferApprovalService(
    database as unknown as ServiceDatabaseService,
    {
      loadConfig: async () => ({
        DEFAULT_BILLING_TIMEZONE: 'Australia/Brisbane',
      }),
    } as unknown as BillingConfigService,
    transfers as unknown as MachineTransfersService,
  );
  return { service, client };
};

beforeEach(() => jest.clearAllMocks());

describe('machine transfer approval', () => {
  it('completes the transfer and stops the seller charge from next month', async () => {
    const { service, client } = setup();
    const result = await service.approveTransfer(
      buyer,
      'transfer-1',
      'Bought at auction',
      new Date('2026-10-20T02:00:00Z'),
    );
    expect(result).toMatchObject({ status: 'completed' });
    expect(transfersRepository.completeMachineTransfer).toHaveBeenCalledWith(
      client,
      {
        transferId: 'transfer-1',
        billingEnd: '2026-11-01',
        actorUserId: 'buyer-admin',
        reason: 'Bought at auction',
      },
    );
    expect(transfersRepository.recordTransferDecision).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        status: 'completed',
        decidedBy: 'buyer-admin',
      }),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('billing.record_audit_entry'),
      expect.any(Array),
    );
  });

  it('uses the seller account day: 31 Oct 15:00 UTC is already November in Brisbane', async () => {
    const { service } = setup();
    await service.approveTransfer(
      buyer,
      'transfer-1',
      null,
      new Date('2026-10-31T15:00:00Z'),
    );
    expect(transfersRepository.completeMachineTransfer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ billingEnd: '2026-12-01' }),
    );
  });

  it('only lets the receiving organisation approve', async () => {
    const { service } = setup();
    await expect(
      service.approveTransfer(
        { ...buyer, tenantId: 'tenant-a' },
        'transfer-1',
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transfersRepository.completeMachineTransfer).not.toHaveBeenCalled();
  });

  it('refuses a transfer that was already decided', async () => {
    const { service } = setup();
    jest
      .mocked(transfersRepository.lockTransfer)
      .mockResolvedValue({ ...pending, status: 'cancelled' });
    await expect(
      service.approveTransfer(buyer, 'transfer-1', null),
    ).rejects.toThrow('already been decided');
  });

  it('refuses when the machine left active before approval', async () => {
    const { service } = setup();
    jest
      .mocked(transfersRepository.completeMachineTransfer)
      .mockResolvedValue(false);
    await expect(
      service.approveTransfer(buyer, 'transfer-1', null),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transfersRepository.recordTransferDecision).not.toHaveBeenCalled();
  });

  it('explains a serial number clash in the buyer organisation', async () => {
    const { service } = setup();
    jest
      .mocked(transfersRepository.completeMachineTransfer)
      .mockRejectedValue(
        Object.assign(new Error('duplicate'), { code: '23505' }),
      );
    await expect(
      service.approveTransfer(buyer, 'transfer-1', null),
    ).rejects.toThrow('serial number');
  });
});
