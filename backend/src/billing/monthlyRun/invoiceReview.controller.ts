import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import { HoldInvoiceDto, ReleaseInvoiceDto } from './dto/invoiceReviewDtos';
import { InvoiceReviewService } from './invoiceReview.service';

// Monthly run review window: hold a draft so it isn't finalised, release
// it to finalise on the next run.
@Controller('admin/billing/invoices')
@PlatformAdminOnly()
export class InvoiceReviewController {
  constructor(private readonly reviewService: InvoiceReviewService) {}

  @Post(':invoiceId/hold')
  @HttpCode(200)
  hold(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: HoldInvoiceDto,
  ) {
    return this.reviewService.holdInvoice(actor, invoiceId, dto.reason);
  }

  @Post(':invoiceId/release')
  @HttpCode(200)
  release(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: ReleaseInvoiceDto,
  ) {
    return this.reviewService.releaseInvoice(
      actor,
      invoiceId,
      dto.reason ?? null,
    );
  }
}
