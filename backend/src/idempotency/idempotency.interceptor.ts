import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as idempotencyRepository from './idempotency.repository';
import { IdempotencyKeyRef } from './idempotency.repository';
import { fingerprintRequest } from './requestFingerprint';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;

const INVALID_KEY_MESSAGE =
  'Idempotency-Key must be 8–100 letters, digits or _ . : - (a UUID works).';
const OTHER_REQUEST_MESSAGE =
  'This Idempotency-Key was already used for a different request.';
const OTHER_BODY_MESSAGE =
  'This Idempotency-Key was already used with a different body. Use a new key for a new request.';
const IN_PROGRESS_MESSAGE =
  'The first request with this Idempotency-Key is still running. Retry shortly.';

// For writes the app queues offline (its outbox): with an Idempotency-Key
// header, the first successful response is saved and every retry with the
// same key and body gets it back instead of writing again. A failed attempt frees
// the key. Without the header the route behaves as before. Use after
// JwtAuthGuard; keys are per user.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  intercept = async (
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> => {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const key = request.header(IDEMPOTENCY_HEADER);
    if (!key || !request.user) return next.handle();
    if (!KEY_PATTERN.test(key))
      throw new BadRequestException(INVALID_KEY_MESSAGE);
    const ref: IdempotencyKeyRef = {
      tenantId: request.user.tenantId,
      userId: request.user.userId,
      key,
    };
    const route = `${request.method} ${request.path}`;
    const requestHash = fingerprintRequest(request);
    const outcome = await this.databaseService.withTenant(
      ref.tenantId,
      (client) =>
        idempotencyRepository.claimKey(client, { ...ref, route, requestHash }),
    );
    if (outcome.state !== 'claimed' && outcome.route !== route) {
      throw new UnprocessableEntityException(OTHER_REQUEST_MESSAGE);
    }
    if (
      outcome.state !== 'claimed' &&
      outcome.requestHash !== null &&
      outcome.requestHash !== requestHash
    ) {
      throw new UnprocessableEntityException(OTHER_BODY_MESSAGE);
    }
    if (outcome.state === 'in_progress')
      throw new ConflictException(IN_PROGRESS_MESSAGE);
    if (outcome.state === 'done') {
      http.getResponse<Response>().status(outcome.status);
      return of(outcome.body);
    }
    const status = this.successStatus(context, request.method);
    return next.handle().pipe(
      mergeMap((body: unknown) =>
        from(
          this.databaseService.withTenant(ref.tenantId, (client) =>
            idempotencyRepository.completeKey(client, { ...ref, status, body }),
          ),
        ).pipe(mergeMap(() => of(body))),
      ),
      catchError((error: unknown) =>
        from(
          this.databaseService.withTenant(ref.tenantId, (client) =>
            idempotencyRepository.releaseKey(client, ref),
          ),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  };

  // The handler's @HttpCode, else Nest's default (201 for POST).
  private successStatus = (context: ExecutionContext, method: string): number =>
    this.reflector.get<number | undefined>(
      HTTP_CODE_METADATA,
      context.getHandler(),
    ) ?? (method === 'POST' ? 201 : 200);
}
