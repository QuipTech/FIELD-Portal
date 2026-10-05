import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import * as demoRequestsRepository from './demoRequests.repository';
import { TurnstileVerifierService } from './turnstileVerifier.service';
import {
  DemoEmailOutcome,
  DemoRequestEmailsService,
} from './demoRequestEmails.service';
import { toDemoRequest } from './demoRequestMapper';
import { CreateDemoRequestDto } from './dto/createDemoRequestDto';
import { ListDemoRequestsQueryDto } from './dto/listDemoRequestsQueryDto';
import { UpdateDemoRequestDto } from './dto/updateDemoRequestDto';
import {
  DemoRequest,
  DemoRequestAccepted,
  DemoRequestPage,
} from './types/demoRequestResponse';

const ACCEPTED: DemoRequestAccepted = { success: true };
const VERIFICATION_FAILED_MESSAGE =
  "We couldn't verify you're human. Please refresh the page and try again.";
const VERIFICATION_UNAVAILABLE_MESSAGE =
  "We couldn't send your request just now. Please try again in a few minutes.";
const NOT_FOUND_MESSAGE = 'Demo request not found.';

@Injectable()
export class DemoRequestsService {
  private readonly logger = new Logger(DemoRequestsService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly turnstileVerifier: TurnstileVerifierService,
    private readonly demoRequestEmails: DemoRequestEmailsService,
  ) {}

  // Public form. Saves first; the emails go out in the background, so the
  // response never waits for (or fails because of) SES.
  submit = async (
    dto: CreateDemoRequestDto,
    ipAddress: string | null,
  ): Promise<DemoRequestAccepted> => {
    if (dto.website) {
      this.logger.warn(`Honeypot filled (ip ${ipAddress}): request dropped.`);
      return ACCEPTED;
    }
    const verification = await this.turnstileVerifier.verify(
      dto.turnstileToken,
      ipAddress,
    );
    if (verification === 'invalid') {
      throw new BadRequestException(VERIFICATION_FAILED_MESSAGE);
    }
    if (verification === 'unavailable') {
      throw new ServiceUnavailableException(VERIFICATION_UNAVAILABLE_MESSAGE);
    }
    const saved = await demoRequestsRepository.insertDemoRequest(
      this.serviceDatabase,
      {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        company: dto.company,
        country: dto.country,
        phone: dto.phone ?? null,
        message: dto.message ?? null,
        ipAddress,
      },
    );
    void this.demoRequestEmails
      .sendPending(saved)
      .catch((error: Error) =>
        this.logger.error(
          `Demo request ${saved.id}: emails failed: ${error.message}`,
        ),
      );
    return ACCEPTED;
  };

  list = async (query: ListDemoRequestsQueryDto): Promise<DemoRequestPage> => {
    const rows = await demoRequestsRepository.listDemoRequests(
      this.serviceDatabase,
      query,
    );
    return {
      items: rows.map(toDemoRequest),
      total: rows.length ? Number(rows[0].total_count) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  };

  get = async (requestId: string): Promise<DemoRequest> =>
    toDemoRequest(await this.requireRow(requestId));

  update = async (
    requestId: string,
    dto: UpdateDemoRequestDto,
  ): Promise<DemoRequest> => {
    const row = await demoRequestsRepository.updateDemoRequest(
      this.serviceDatabase,
      requestId,
      { status: dto.status, notes: dto.notes },
    );
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return toDemoRequest(row);
  };

  // Retries whichever emails haven't gone out yet, and waits for them so
  // the portal can show the result.
  resendEmails = async (
    requestId: string,
  ): Promise<DemoEmailOutcome & { request: DemoRequest }> => {
    const outcome = await this.demoRequestEmails.sendPending(
      await this.requireRow(requestId),
    );
    return { ...outcome, request: await this.get(requestId) };
  };

  private requireRow = async (requestId: string) => {
    const row = await demoRequestsRepository.findDemoRequest(
      this.serviceDatabase,
      requestId,
    );
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return row;
  };
}
