import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { BILLING_MANAGE_PERMISSION } from '../customerBilling/billingPermissions';
import { StatementsService } from './statements.service';

// A 30-day account organisation's monthly statements (invoiced by QuipTech
// in Zoho): billing.manage only.
@Controller('organisation/billing')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(BILLING_MANAGE_PERMISSION)
export class OrganisationStatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get('statements')
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.statements.listForOrganisation(actor);
  }
}
