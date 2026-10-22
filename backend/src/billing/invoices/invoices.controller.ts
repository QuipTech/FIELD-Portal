import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import { InvoicesService } from './invoices.service';
import { CreateTestInvoiceDto } from './dto/createTestInvoiceDto';
import { ListInvoicesQueryDto } from './dto/listInvoicesQueryDto';

@Controller('admin/billing')
@PlatformAdminOnly()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('test-invoices')
  createTestInvoice(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTestInvoiceDto,
  ) {
    return this.invoicesService.createTestInvoice(actor, dto);
  }

  @Get('invoices')
  listInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.listInvoices(query);
  }

  @Get('invoices/:invoiceId')
  getInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.invoicesService.getInvoice(invoiceId);
  }
}
