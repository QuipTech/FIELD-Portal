import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { PLATFORM_PERMISSION_CODE } from '../auth/systemRoleNames';
import { AiPromptsService } from './prompts/aiPrompts.service';
import { AiPromptTestService } from './prompts/aiPromptTest.service';
import { CreatePromptVersionDto } from './dto/createPromptVersionDto';
import { TestPromptDto } from './dto/testPromptDto';
import { PromptDiffQueryDto } from './dto/promptDiffQueryDto';

// The platform-wide assistant prompt and its version history. Owner
// only (platform.manage).
@Controller('admin/ai/prompts')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(PLATFORM_PERMISSION_CODE)
export class AdminAiPromptsController {
  constructor(
    private readonly aiPromptsService: AiPromptsService,
    private readonly aiPromptTestService: AiPromptTestService,
  ) {}

  @Get()
  list() {
    return this.aiPromptsService.listVersions();
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePromptVersionDto,
  ) {
    return this.aiPromptsService.createVersion(actor, dto);
  }

  // Calls Bedrock; nothing is saved.
  @Post('test')
  @HttpCode(HttpStatus.OK)
  test(@Body() dto: TestPromptDto) {
    return this.aiPromptTestService.testPrompt(dto);
  }

  @Get(':versionId')
  get(@Param('versionId', ParseUUIDPipe) versionId: string) {
    return this.aiPromptsService.getVersion(versionId);
  }

  @Get(':versionId/diff')
  diff(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query() query: PromptDiffQueryDto,
  ) {
    return this.aiPromptsService.diffVersions(versionId, query.against);
  }

  // Makes this version live — also how an older one is rolled back to.
  @Post(':versionId/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.aiPromptsService.publishVersion(actor, versionId);
  }
}
