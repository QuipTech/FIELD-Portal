import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { OrganisationBrandAccessService } from './organisationBrandAccess.service';
import { OrganisationBrandAccessDto } from './dto/knowledgeBrandDto';

@Controller('admin/organisations/:organisationId/brand-access')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class OrganisationBrandAccessController {
  constructor(private readonly access: OrganisationBrandAccessService) {}
  @Get() get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('organisationId', ParseUUIDPipe) id: string,
  ) {
    return this.access.get(actor, id);
  }
  @Put() set(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('organisationId', ParseUUIDPipe) id: string,
    @Body() dto: OrganisationBrandAccessDto,
  ) {
    return this.access.set(actor, id, dto.brandIds);
  }
}
