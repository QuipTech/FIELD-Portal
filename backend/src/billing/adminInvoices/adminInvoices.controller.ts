import { Controller, Get, Post, Query } from '@nestjs/common';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import { AdminInvoicesService } from './adminInvoices.service';
import { AdminInvoicesQueryDto } from './adminInvoicesQueryDto';

@Controller('admin/billing/overview')
@PlatformAdminOnly()
export class AdminInvoicesController {
  constructor(private readonly invoices: AdminInvoicesService) {}

  @Get('invoices')
  list(@Query() query: AdminInvoicesQueryDto) {
    return this.invoices.list(query);
  }

  @Post('refresh-from-stripe')
  refreshFromStripe() {
    return this.invoices.refreshFromStripe();
  }
}
