import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { DemoRequestsService } from './demoRequests.service';
import { CreateDemoRequestDto } from './dto/createDemoRequestDto';

// The marketing site's demo form. No sign-in; protected by Turnstile, a
// honeypot field and a per-IP limit (5 an hour, demoRequestsThrottle.ts).
// CORS for /public/* is the marketing site only (publicOrigins.ts).
@Controller('public/demo-requests')
@UseGuards(ThrottlerGuard)
export class PublicDemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  submit(@Req() request: Request, @Body() dto: CreateDemoRequestDto) {
    return this.demoRequestsService.submit(dto, request.ip ?? null);
  }
}
