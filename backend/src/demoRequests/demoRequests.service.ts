import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import * as demoRequestsRepository from './demoRequests.repository';
import {
  DemoEmailOutcome,
  DemoRequestEmailsService,
} from './demoRequestEmails.service';
import { toDemoRequest } from './demoRequestMapper';
import { NewDemoRequest } from './demoRequests.repository';
import { CreateDemoRequestDto } from './dto/createDemoRequestDto';
import { ListDemoRequestsQueryDto } from './dto/listDemoRequestsQueryDto';
import { UpdateDemoRequestDto } from './dto/updateDemoRequestDto';
import {
  DemoRequest,
  DemoRequestAccepted,
  DemoRequestPage,
} from './types/demoRequestResponse';

const ACCEPTED: DemoRequestAccepted = { ok: true };
const TRY_AGAIN_LATER_MESSAGE =
  "We couldn't send your request just now. Please try again in a few minutes.";
const NOT_FOUND_MESSAGE = 'Demo request not found.';

@Injectable()
export class DemoRequestsService {
  private readonly logger = new Logger(DemoRequestsService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly demoRequestEmails: DemoRequestEmailsService,
  ) {}

  // Public form. Saves first; the emails go out in the background, so the
  // response never waits for (or fails because of) SES. Only if saving
  // fails does it wait on the team email, which is then the only record.
  submit = async (
    dto: CreateDemoRequestDto,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<DemoRequestAccepted> => {
    if (dto.website) {
      this.logger.warn(`Honeypot filled (ip ${ipAddress}): request dropped.`);
      return ACCEPTED;
    }
    const newRequest: NewDemoRequest = {
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      company: dto.company,
      country: dto.country,
      phone: dto.phone ?? null,
      message: dto.message ?? null,
      ipAddress,
      userAgent,
    };
    const saved = await demoRequestsRepository
      .insertDemoRequest(this.serviceDatabase, newRequest)
      .catch((error: Error) => {
        this.logger.error(`Demo request not saved: ${error.message}`);
        return null;
      });
    if (!saved) return this.notifyTeamOfUnsaved(newRequest);
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

  private notifyTeamOfUnsaved = async (
    request: NewDemoRequest,
  ): Promise<DemoRequestAccepted> => {
    const sent = await this.demoRequestEmails.sendUnsavedTeamEmail({
      email: request.email,
      first_name: request.firstName,
      last_name: request.lastName,
      company: request.company,
      country: request.country,
      phone: request.phone,
      message: request.message,
      created_at: new Date(),
    });
    if (!sent) throw new ServiceUnavailableException(TRY_AGAIN_LATER_MESSAGE);
    return ACCEPTED;
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
