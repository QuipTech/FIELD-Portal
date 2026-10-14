import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

// ?page=&pageSize= for a paged list; extend it in the list's query DTO.
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 25;
}

// SQL LIMIT/OFFSET for a page.
export const toLimitOffset = ({ page, pageSize }: PaginationQueryDto) => ({
  limit: pageSize,
  offset: (page - 1) * pageSize,
});
