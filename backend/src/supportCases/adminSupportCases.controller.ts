import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
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
import {
  CurrentSupportStaff,
  SupportStaffContext,
  SupportStaffGuard,
} from './supportStaff.guard';
import { AdminSupportCasesService } from './adminSupportCases.service';
import { AdminCaseUpdatesService } from './adminCaseUpdates.service';
import { ListAdminSupportCasesQueryDto } from './dto/listAdminSupportCasesQueryDto';
import { UpdateSupportCaseDto } from './dto/updateSupportCaseDto';
import { PostStaffCaseMessageDto } from './dto/postStaffCaseMessageDto';

// The support queue and case screens for QuipTech staff, across every
// organisation. The admin (platform.manage) works every case; a Support
// Agent only the cases assigned to them — any other case number is 404.
@Controller('admin')
@UseGuards(JwtAuthGuard, SupportStaffGuard)
export class AdminSupportCasesController {
  constructor(
    private readonly adminSupportCasesService: AdminSupportCasesService,
    private readonly adminCaseUpdatesService: AdminCaseUpdatesService,
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
  ) {
    return this.adminSupportCasesService.listMessages(actor, caseNumber);
  }

  @Get('cases/:caseNumber/events')
  listEvents(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.adminSupportCasesService.listEvents(actor, caseNumber);
  }

  // { body, isInternal, attachmentIds }
  @Post('cases/:caseNumber/messages')
  postMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Body() dto: PostStaffCaseMessageDto,
  ) {
    return this.adminCaseUpdatesService.postMessage(actor, caseNumber, dto);
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
