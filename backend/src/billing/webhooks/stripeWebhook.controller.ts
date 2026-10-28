import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from '../stripe/stripe.service';
import { StripeWebhookService } from './stripeWebhook.service';

// Stripe → FIELD. No JWT: authenticity comes from the Stripe-Signature
// header, checked against the exact bytes received. main.ts creates the app
// with rawBody: true, which keeps request.rawBody next to the parsed JSON
// on every route, so no other route's parsing changes.
@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly stripeWebhookService: StripeWebhookService,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature || !request.rawBody)
      throw new BadRequestException('Missing Stripe signature or body.');
    let event;
    try {
      event = this.stripeService.constructWebhookEvent(
        request.rawBody,
        signature,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadRequestException('Invalid Stripe signature.');
    }
    return this.stripeWebhookService.handleEvent(event);
  }
}
