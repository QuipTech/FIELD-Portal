import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import { BillingAccountsService } from './billingAccounts.service';
import { CreateBillingAccountDto } from './dto/createBillingAccountDto';

@Controller('admin/billing')
@PlatformAdminOnly()
export class BillingAccountsController {
  constructor(
    private readonly billingAccountsService: BillingAccountsService,
  ) {}

  @Get('organisations')
  listOrganisations() {
    return this.billingAccountsService.listOrganisations();
  }

  @Post('accounts')
  createAccount(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateBillingAccountDto,
  ) {
    return this.billingAccountsService.createAccount(actor, dto);
  }
}
