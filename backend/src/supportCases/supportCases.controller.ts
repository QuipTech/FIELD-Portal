import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { SupportCasesService } from './supportCases.service';
import { CaseMessagesService } from './caseMessages.service';
import { ListSupportCasesQueryDto } from './dto/listSupportCasesQueryDto';
import { CreateSupportCaseDto } from './dto/createSupportCaseDto';
import { UpdateSupportCaseDto } from './dto/updateSupportCaseDto';
import { PostCaseMessageDto } from './dto/postCaseMessageDto';

// Support cases in the caller's own organisation, addressed by case number
// (#1042). Raising, reading and replying need support.create; assigning,
// reprioritising and resolving need support.manage.
@Controller('support-cases')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class SupportCasesController {
  constructor(
    private readonly supportCasesService: SupportCasesService,
    private readonly caseMessagesService: CaseMessagesService,
  ) {}

  @Get()
  @RequirePermissions('support.create')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSupportCasesQueryDto,
  ) {
    return this.supportCasesService.listCases(actor, query);
  }

  // Assignees and machines for the filters and the New case form.
  @Get('options')
  @RequirePermissions('support.create')
  options(@CurrentUser() actor: AuthenticatedUser) {
    return this.supportCasesService.getOptions(actor);
  }

  @Post()
  @RequirePermissions('support.create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSupportCaseDto,
  ) {
    return this.supportCasesService.createCase(actor, dto);
  }

  @Get(':caseNumber')
  @RequirePermissions('support.create')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.supportCasesService.getCase(actor, caseNumber);
  }

  @Patch(':caseNumber')
  @RequirePermissions('support.manage')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Body() dto: UpdateSupportCaseDto,
  ) {
    return this.supportCasesService.updateCase(actor, caseNumber, dto);
  }

  @Get(':caseNumber/messages')
  @RequirePermissions('support.create')
  listMessages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
  ) {
    return this.caseMessagesService.listMessages(actor, caseNumber);
  }

  // Saved, then pushed live to everyone with the case open.
  @Post(':caseNumber/messages')
  @RequirePermissions('support.create')
  postMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('caseNumber', ParseIntPipe) caseNumber: number,
    @Body() dto: PostCaseMessageDto,
  ) {
    return this.caseMessagesService.postMessage(actor, caseNumber, dto);
  }
}
