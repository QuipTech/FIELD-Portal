import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { DatabaseService } from '../database/database.service';
import * as adminUsersRepository from './adminUsers.repository';

// Organisations the admin can filter by and invite into: every one for
// the Owner.
@Controller('admin/organisations')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminOrganisationsController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  list(@CurrentAdminScope() scope: AdminScope) {
    return adminUsersRepository.listOrganisations(this.databaseService, scope);
  }
}
