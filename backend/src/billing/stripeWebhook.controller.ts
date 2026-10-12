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
import { StripeClient } from './stripeClient';
import { StripeWebhookService } from './stripeWebhook.service';

// Stripe → FIELD. No JWT: authenticity comes from the Stripe-Signature
// header, checked against the raw body (main.ts enables rawBody).
@Controller('billing/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeClient: StripeClient,
    private readonly stripeWebhookService: StripeWebhookService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!signature || !request.rawBody)
      throw new BadRequestException('Missing Stripe signature or body.');
    let event;
    try {
      event = this.stripeClient.constructWebhookEvent(
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
