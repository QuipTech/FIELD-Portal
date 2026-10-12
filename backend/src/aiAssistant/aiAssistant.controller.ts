import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AiAskContextService } from './aiAskContext.service';
import { AiAskService } from './aiAsk.service';
import { AiConversationsService } from './aiConversations.service';
import { AskAssistantDto } from './dto/askAssistantDto';
import { openEventStream } from './openEventStream';

// The technician-facing AI assistant. Tenant and user come from the JWT;
// every route needs ai.use.
@Controller('ai')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions('ai.use')
export class AiAssistantController {
  constructor(
    private readonly askContext: AiAskContextService,
    private readonly aiAsk: AiAskService,
    private readonly aiConversations: AiConversationsService,
  ) {}

  // Answers as server-sent events (see AskStreamEvent). Validation, an
  // unknown thread or machine, and retrieval failures are ordinary JSON
  // errors; once the stream starts, failures arrive as an `error` event.
  @Post('ask')
  async ask(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AskAssistantDto,
    @Res() response: Response,
  ): Promise<void> {
    const prepared = await this.askContext.prepare(actor, dto);
    await this.aiAsk.streamAnswer(actor, prepared, openEventStream(response));
  }

  @Get('conversations')
  listConversations(@CurrentUser() actor: AuthenticatedUser) {
    return this.aiConversations.listConversations(actor);
  }

  @Get('conversations/:conversationId')
  getThread(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.aiConversations.getThread(actor, conversationId);
  }
}
