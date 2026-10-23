import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { PLAN_CODES } from '../subscriptions/planCodes';
import { lockLiveSubscription } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  planSeatAddition,
  planSeatBillingEnd,
  SeatInterval,
} from './seatRules';
import * as seatsRepository from './seats.repository';

const USER_NOT_ON_ACCOUNT_MESSAGE =
  "That user isn't in any organisation on this billing account.";
const SEAT_ALREADY_HELD_MESSAGE = 'That user already holds a TECH seat.';
const SEAT_NOT_FOUND_MESSAGE = 'Seat not found.';
const SEAT_ALREADY_REMOVED_MESSAGE = 'That seat has already been removed.';

// TECH seats. The first seat on an account starts a monthly TECH
// subscription; a removed seat counts to the end of the month.
@Injectable()
export class SeatsService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  listSeats = async (billingAccountId: string): Promise<SeatInterval[]> =>
    (
      await seatsRepository.listAccountSeats(
        this.serviceDatabase,
        billingAccountId,
      )
    ).map(seatsRepository.toSeatInterval);

  addSeat = async (
    actor: BillingActor,
    billingAccountId: string,
    userId: string,
    now = new Date(),
  ): Promise<SeatInterval> => {
    const account =
      await this.billingAccountsService.requireAccount(billingAccountId);
    const today = toBillingDay(now, account.timezone);
    const newTechTerm = await this.subscriptionsService.planNewTerm(
      PLAN_CODES.tech,
      { term: 'monthly' },
      account.timezone,
      now,
    );

    return this.serviceDatabase.transaction(async (client) => {
      if (!(await seatsRepository.isUserOnAccount(client, userId, account.id)))
        throw new BadRequestException(USER_NOT_ON_ACCOUNT_MESSAGE);
      const subscriptionId =
        (await lockLiveSubscription(client, account.id, PLAN_CODES.tech))?.id ??
        (
          await this.subscriptionsService.createSubscription(client, actor, {
            billingAccountId: account.id,
            planCode: PLAN_CODES.tech,
            plan: newTechTerm,
            reason: 'first TECH seat',
          })
        ).id;

      const userSeats = (
        await seatsRepository.lockUserSeats(client, subscriptionId, userId)
      ).map(seatsRepository.toSeatInterval);
      const addition = planSeatAddition(userSeats, today);
      if (addition.kind === 'alreadyHeld')
        throw new ConflictException(SEAT_ALREADY_HELD_MESSAGE);

      const row =
        addition.kind === 'reinstate'
          ? await seatsRepository.setSeatBillingEnd(
              client,
              addition.seatId,
              null,
            )
          : await seatsRepository.insertSeat(client, {
              billingAccountId: account.id,
              subscriptionId,
              userId,
              startedOn: today,
              createdBy: actor.userId,
            });
      const seat = seatsRepository.toSeatInterval(row);
      await this.auditSeat(client, actor, account.id, seat, {
        from: addition.kind === 'reinstate' ? 'removed' : null,
        reason:
          addition.kind === 'reinstate' ? 'seat reinstated' : 'seat added',
      });
      return seat;
    });
  };

  removeSeat = async (
    actor: BillingActor,
    billingAccountId: string,
    seatId: string,
    reason: string,
    now = new Date(),
  ): Promise<SeatInterval> => {
    const account =
      await this.billingAccountsService.requireAccount(billingAccountId);
    const billingEnd = planSeatBillingEnd(toBillingDay(now, account.timezone));

    return this.serviceDatabase.transaction(async (client) => {
      const current = await seatsRepository.lockSeat(client, seatId);
      if (!current || current.billing_account_id !== account.id)
        throw new NotFoundException(SEAT_NOT_FOUND_MESSAGE);
      if (current.billing_end !== null)
        throw new ConflictException(SEAT_ALREADY_REMOVED_MESSAGE);
      const seat = seatsRepository.toSeatInterval(
        await seatsRepository.setSeatBillingEnd(client, seatId, billingEnd),
      );
      await this.auditSeat(client, actor, account.id, seat, {
        from: 'held',
        reason,
      });
      return seat;
    });
  };

  private auditSeat = (
    client: PoolClient,
    actor: BillingActor,
    billingAccountId: string,
    seat: SeatInterval,
    change: { from: string | null; reason: string },
  ) =>
    recordBillingAudit(client, actor, {
      action: change.from === null ? 'create' : 'update',
      entityType: 'billing_seat',
      entityId: seat.id,
      billingAccountId,
      from: change.from,
      to: seat.billingEnd === null ? 'held' : `removed from ${seat.billingEnd}`,
      reason: change.reason,
      metadata: { userId: seat.userId },
    });
}
