import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
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
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { CASE_ATTACHMENT_RULE } from '../storage/storageFileRules';
import { IncomingFile } from '../storage/types/storedFile';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import {
  CurrentSupportStaff,
  SupportStaffContext,
  SupportStaffGuard,
} from './supportStaff.guard';
import { AdminSupportCasesService } from './adminSupportCases.service';
import { AdminCaseUpdatesService } from './adminCaseUpdates.service';
import { AdminCaseNotesService } from './adminCaseNotes.service';
import { ListAdminSupportCasesQueryDto } from './dto/listAdminSupportCasesQueryDto';
import { UpdateSupportCaseDto } from './dto/updateSupportCaseDto';
import { PostStaffCaseMessageDto } from './dto/postStaffCaseMessageDto';
import { UpdateCaseNoteDto } from './dto/updateCaseNoteDto';
import { ThreadSinceQueryDto } from './dto/threadSinceQueryDto';

// The support queue and case screens for QuipTech staff, across every
// organisation. The admin (platform.manage) works every case; a Support
// Agent only the cases assigned to them — any other case number is 404.
@Controller('admin')
@UseGuards(JwtAuthGuard, SupportStaffGuard)
export class AdminSupportCasesController {
  constructor(
    private readonly adminSupportCasesService: AdminSupportCasesService,
    private readonly adminCaseUpdatesService: AdminCaseUpdatesService,
    private readonly adminCaseNotesService: AdminCaseNotesService,
  ) {}

  // ?tab=unassigned|mine|open|resolved&company=&priority=&status=&search=
  @Get('cases')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentSupportStaff() staff: SupportStaffContext,
    @Query() query: ListAdminSupportCasesQueryDto,
  ) {
    return this.adminSupportCasesService.listCases(actor, staff, query);
  }

  @Get('cases/stats')
  stats(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentSupportStaff() staff: SupportStaffContext,
  ) {
    return this.adminSupportCasesService.getStats(actor, staff);
  }

  // Whether the caller is support staff (403 if not) and the admin: the
  // portal shows the Support cases screens from this.
  @Get('cases/access')
  access(@CurrentSupportStaff() staff: SupportStaffContext) {
    return staff;
  }

  @Get('cases/unread-count')
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.adminSupportCasesService.countUnread(actor);
  }

  // The assign dropdown: support staff with their open case counts.
  @Get('staff')
  @UseGuards(RequirePermissionsGuard)
  @RequirePermissions(PLATFORM_PERMISSION_CODE)
  staffList() {
    return this.adminSupportCasesService.listStaff();
  }

  @Get('cases/:caseNumber')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.adminSupportCasesService.getCase(actor, caseNumber);
  }

  // { assigneeId, status, priority }: the admin may change any of them;
  // the assignee only the status.
  @Patch('cases/:caseNumber')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Body() dto: UpdateSupportCaseDto,
  ) {
    return this.adminCaseUpdatesService.updateCase(actor, caseNumber, dto);
  }

  // Internal notes included.
  @Get('cases/:caseNumber/messages')
  listMessages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Query() query: ThreadSinceQueryDto,
  ) {
    return this.adminSupportCasesService.listMessages(
      actor,
      caseNumber,
      query.since,
    );
  }

  @Get('cases/:caseNumber/events')
  listEvents(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Query() query: ThreadSinceQueryDto,
  ) {
    return this.adminSupportCasesService.listEvents(
      actor,
      caseNumber,
      query.since,
    );
  }

  // { body, isInternal, attachmentIds }; Idempotency-Key makes a resend safe.
  @Post('cases/:caseNumber/messages')
  @UseInterceptors(IdempotencyInterceptor)
  postMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Body() dto: PostStaffCaseMessageDto,
  ) {
    return this.adminCaseUpdatesService.postMessage(actor, caseNumber, dto);
  }

  // Internal notes only: the author or the support admin.
  @Patch('cases/:caseNumber/notes/:noteId')
  updateNote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateCaseNoteDto,
  ) {
    return this.adminCaseNotesService.updateNote(
      actor,
      caseNumber,
      noteId,
      dto.body,
    );
  }

  @Delete('cases/:caseNumber/notes/:noteId')
  @HttpCode(204)
  deleteNote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.adminCaseNotesService.deleteNote(actor, caseNumber, noteId);
  }

  @Post('cases/:caseNumber/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CASE_ATTACHMENT_RULE.maxBytes, files: 1 },
    }),
  )
  uploadAttachment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @UploadedFile() file: IncomingFile | undefined,
  ) {
    return this.adminCaseUpdatesService.uploadAttachment(
      actor,
      caseNumber,
      file,
    );
  }

  @Post('cases/:caseNumber/read')
  @HttpCode(204)
  markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.adminSupportCasesService.markRead(actor, caseNumber);
  }
}
