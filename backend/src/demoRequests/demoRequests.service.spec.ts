import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import * as repository from './demoRequests.repository';
import { DemoRequestsService } from './demoRequests.service';
import { DemoRequestEmailsService } from './demoRequestEmails.service';
import { DemoRequestsConfig } from './demoRequestsConfig';
import {
  TurnstileResult,
  TurnstileVerifierService,
} from './turnstileVerifier.service';
import { CreateDemoRequestDto } from './dto/createDemoRequestDto';
import { DemoRequestRow } from './types/demoRequestRows';

jest.mock('./demoRequests.repository');
const mockedRepository = jest.mocked(repository);

const ROW: DemoRequestRow = {
  id: '6f1c2c4e-8a8b-4d7e-9a43-2f2a1d1c0b11',
  email: 'jo@acme.com',
  first_name: 'Jo',
  last_name: 'Bloggs',
  company: 'Acme Mining',
  country: 'Australia',
  phone: null,
  message: null,
  status: 'new',
  notes: null,
  team_email_sent_at: null,
  user_email_sent_at: null,
  ip_address: '203.0.113.9',
  created_at: new Date('2026-10-04T01:00:00Z'),
  updated_at: new Date('2026-10-04T01:00:00Z'),
};

const DTO = {
  email: ROW.email,
  firstName: ROW.first_name,
  lastName: ROW.last_name,
  company: ROW.company,
  country: ROW.country,
  turnstileToken: 'token',
} as CreateDemoRequestDto;

const config = {
  notifyEmails: ['sales@quiptech.example', 'ops@quiptech.example'],
  requestUrl: (id: string) =>
    `https://portal.example/admin/demo-requests?id=${id}`,
} as unknown as DemoRequestsConfig;

// Lets the background email work (not awaited by submit) finish.
const flushBackgroundWork = () =>
  new Promise((resolve) => setImmediate(resolve));

const setup = (options: {
  turnstile?: TurnstileResult;
  sendEmail?: jest.Mock;
}) => {
  const sendEmail =
    options.sendEmail ?? jest.fn().mockResolvedValue({ messageId: 'ses-1' });
  const verify = jest.fn().mockResolvedValue(options.turnstile ?? 'valid');
  const database = {} as ServiceDatabaseService;
  const emails = new DemoRequestEmailsService(
    { sendEmail } as unknown as EmailService,
    database,
    config,
  );
  const service = new DemoRequestsService(
    database,
    { verify } as unknown as TurnstileVerifierService,
    emails,
  );
  return { service, sendEmail, verify };
};

describe('DemoRequestsService.submit', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRepository.insertDemoRequest.mockResolvedValue(ROW);
    mockedRepository.markEmailSent.mockResolvedValue();
  });

  it('saves, then emails the team (Reply-To the requester) and the requester', async () => {
    const { service, sendEmail } = setup({});
    await expect(service.submit(DTO, '203.0.113.9')).resolves.toEqual({
      success: true,
    });
    expect(mockedRepository.insertDemoRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: ROW.email, ipAddress: '203.0.113.9' }),
    );
    await flushBackgroundWork();
    const sent = sendEmail.mock.calls.map(([email]) => email);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'sales@quiptech.example',
          replyTo: ROW.email,
          subject: 'New demo request: Acme Mining',
        }),
        expect.objectContaining({ to: 'ops@quiptech.example' }),
        expect.objectContaining({ to: ROW.email }),
      ]),
    );
    expect(
      mockedRepository.markEmailSent.mock.calls.map((c) => c[2]).sort(),
    ).toEqual(['team', 'user']);
  });

  it('honeypot: reports success but saves and sends nothing', async () => {
    const { service, sendEmail, verify } = setup({});
    await expect(
      service.submit(
        { ...DTO, website: 'http://spam.example' },
        '198.51.100.1',
      ),
    ).resolves.toEqual({ success: true });
    await flushBackgroundWork();
    expect(verify).not.toHaveBeenCalled();
    expect(mockedRepository.insertDemoRequest).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('refuses an invalid Turnstile token without saving', async () => {
    const { service } = setup({ turnstile: 'invalid' });
    await expect(service.submit(DTO, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockedRepository.insertDemoRequest).not.toHaveBeenCalled();
  });

  it('refuses (try again later) when Turnstile cannot be checked', async () => {
    const { service } = setup({ turnstile: 'unavailable' });
    await expect(service.submit(DTO, null)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mockedRepository.insertDemoRequest).not.toHaveBeenCalled();
  });

  it('still succeeds when SES fails, leaving both sent times empty', async () => {
    const sendEmail = jest.fn().mockRejectedValue(new Error('SES throttled'));
    const { service } = setup({ sendEmail });
    await expect(service.submit(DTO, null)).resolves.toEqual({ success: true });
    await flushBackgroundWork();
    expect(mockedRepository.insertDemoRequest).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalled();
    expect(mockedRepository.markEmailSent).not.toHaveBeenCalled();
  });

  it('does not count a logged-only email (NOTIFICATIONS_ENABLED off) as sent', async () => {
    const sendEmail = jest.fn().mockResolvedValue({ messageId: null });
    const { service } = setup({ sendEmail });
    await service.submit(DTO, null);
    await flushBackgroundWork();
    expect(mockedRepository.markEmailSent).not.toHaveBeenCalled();
  });
});

describe('DemoRequestsService.resendEmails', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedRepository.markEmailSent.mockResolvedValue();
  });

  it('only retries the email that has not gone out', async () => {
    const teamAlreadySent = { ...ROW, team_email_sent_at: new Date() };
    mockedRepository.findDemoRequest.mockResolvedValue(teamAlreadySent);
    const { service, sendEmail } = setup({});
    const result = await service.resendEmails(ROW.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe(ROW.email);
    expect(result).toMatchObject({ teamEmailSent: true, userEmailSent: true });
  });
});
