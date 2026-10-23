import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ForMyMachinesQueryDto } from '../dto/forMyMachinesQueryDto';
import { RecordRecentViewDto } from '../dto/recordRecentViewDto';
import { MyKnowledgeService } from './myKnowledge.service';

// The signed-in user's own Knowledge shortcuts.
@Controller('me/knowledge')
@UseGuards(JwtAuthGuard)
export class MyKnowledgeController {
  constructor(private readonly myKnowledge: MyKnowledgeService) {}

  @Get('recent')
  listRecent(@CurrentUser() actor: AuthenticatedUser) {
    return this.myKnowledge.listRecent(actor);
  }

  @Post('recent')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordView(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RecordRecentViewDto,
  ) {
    return this.myKnowledge.recordView(actor, dto);
  }

  @Get('for-my-machines')
  listForMyMachines(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ForMyMachinesQueryDto,
  ) {
    return this.myKnowledge.listForMyMachines(actor, query);
  }
}
