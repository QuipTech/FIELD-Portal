import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PlatformAdminOnly } from '../../billing/platformAdminOnly.decorator';
import {
  ListMachineControlOrganisationsQueryDto,
  SetMachineControlDto,
} from './adminMachineControl.dtos';
import { AdminMachineControlService } from './adminMachineControl.service';

@Controller('admin/machine-control/organisations')
@PlatformAdminOnly()
export class AdminMachineControlController {
  constructor(private readonly admin: AdminMachineControlService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMachineControlOrganisationsQueryDto,
  ) {
    return this.admin.listOrganisations(user, query.search);
  }

  @Patch(':tenantId')
  setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetMachineControlDto,
  ) {
    return this.admin.setEnabled(user, tenantId, dto.enabled);
  }
}
