import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';
import {
  ADMIN_INVOICE_CATEGORIES,
  AdminInvoiceCategory,
} from './adminInvoiceCategories';

export class AdminInvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ADMIN_INVOICE_CATEGORIES)
  category?: AdminInvoiceCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
