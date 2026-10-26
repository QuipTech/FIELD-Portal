import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import {
  AnnualQuoteQueryDto,
  NextTermDto,
  ReasonDto,
} from '../billingOperations/billingOperationsDtos';
import { BILLING_MANAGE_PERMISSION } from './billingPermissions';
import { OrganisationPlanService } from './organisationPlan.service';

// The organisation's own plan (billing.manage: Owner, Organisation Admin).
@Controller('organisation/billing')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(BILLING_MANAGE_PERMISSION)
export class OrganisationPlanController {
  constructor(private readonly plans: OrganisationPlanService) {}

  @Get()
  getSummary(@CurrentUser() actor: AuthenticatedUser) {
    return this.plans.getSummary(actor);
  }

  @Get('annual-quote')
  quoteAnnual(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AnnualQuoteQueryDto,
  ) {
    return this.plans.quoteAnnual(actor, query.committedQty);
  }

  @Put('next-term')
  chooseNextTerm(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: NextTermDto,
  ) {
    return this.plans.chooseNextTerm(
      actor,
      dto.term === 'annual'
        ? { term: 'annual', committedQty: dto.committedQty! }
        : { term: 'monthly' },
    );
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ReasonDto) {
    return this.plans.cancel(actor, dto.reason);
  }

  @Delete('cancel')
  keep(@CurrentUser() actor: AuthenticatedUser) {
    return this.plans.keep(actor);
  }
}
