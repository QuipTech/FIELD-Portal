import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { CASE_ATTACHMENT_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { SupportCasesService } from './supportCases.service';
import { CaseMessagesService } from './caseMessages.service';
import { SUPPORT_CREATE_PERMISSION } from './caseAccessPolicy';
import { ListSupportCasesQueryDto } from './dto/listSupportCasesQueryDto';
import { CreateSupportCaseDto } from './dto/createSupportCaseDto';
import { PostCaseMessageDto } from './dto/postCaseMessageDto';

// The customer side: support cases in the caller's own organisation,
// addressed by case number (#1042). Everything needs support.create.
// Assigning and changing status or priority are staff routes
// (/admin/cases). Also served at /support-cases, the path the mobile app
// already calls.
@Controller(['cases', 'support-cases'])
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(SUPPORT_CREATE_PERMISSION)
export class SupportCasesController {
  constructor(
    private readonly supportCasesService: SupportCasesService,
    private readonly caseMessagesService: CaseMessagesService,
  ) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSupportCasesQueryDto,
  ) {
    return this.supportCasesService.listCases(actor, query);
  }

  // Machines for the New case form.
  @Get('options')
  options(@CurrentUser() actor: AuthenticatedUser) {
    return this.supportCasesService.getOptions(actor);
  }

  // The "Support cases" nav badge: my cases with an unread reply.
  @Get('unread-count')
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.caseMessagesService.countUnread(actor);
  }

  // multipart/form-data `file`: a photo or PDF/Word document (≤ 20 MB).
  // Send the returned id in attachmentIds with the case or message.
  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CASE_ATTACHMENT_RULE.maxBytes, files: 1 },
    }),
  )
  uploadAttachment(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.caseMessagesService.uploadAttachment(actor, file);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSupportCaseDto,
  ) {
    return this.supportCasesService.createCase(actor, dto);
  }

  @Get(':caseNumber')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.supportCasesService.getCase(actor, caseNumber);
  }

  // Internal notes are never included.
  @Get(':caseNumber/messages')
  listMessages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.caseMessagesService.listMessages(actor, caseNumber);
  }

  // The thread's system lines (assigned, status changed, …).
  @Get(':caseNumber/events')
  listEvents(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.caseMessagesService.listEvents(actor, caseNumber);
  }

  @Post(':caseNumber/messages')
  postMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Body() dto: PostCaseMessageDto,
  ) {
    return this.caseMessagesService.postMessage(actor, caseNumber, dto);
  }

  @Post(':caseNumber/read')
  @HttpCode(204)
  markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.caseMessagesService.markRead(actor, caseNumber);
  }

  // 409 unless the case was resolved in the last 7 days.
  @Post(':caseNumber/reopen')
  @HttpCode(200)
  reopen(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.supportCasesService.reopenCase(actor, caseNumber);
  }
}
