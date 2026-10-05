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

// platform.demo_requests.user_agent's width (migration 0067).
const USER_AGENT_MAX = 512;

// The marketing site's demo form. No sign-in; protected by a honeypot
// field and a per-IP limit (5 per 10 minutes, demoRequestsThrottle.ts).
// CORS for /public/* is the marketing site only (publicOrigins.ts).
@Controller('public/demo-requests')
@UseGuards(ThrottlerGuard)
export class PublicDemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(@Req() request: Request, @Body() dto: CreateDemoRequestDto) {
    const userAgent = request.get('user-agent')?.slice(0, USER_AGENT_MAX);
    return this.demoRequestsService.submit(
      dto,
      request.ip ?? null,
      userAgent || null,
    );
  }
}
