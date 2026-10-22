import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/paginationQueryDto';
import { INVOICE_STATUSES, InvoiceStatus } from '../invoiceStatuses';

export class ListInvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  billingAccountId?: string;

  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;
}
