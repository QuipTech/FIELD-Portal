import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { HISTORY_ENTRY_TYPES } from './createHistoryEntryDto';

export const MAX_HISTORY_PAGE_SIZE = 100;

// Every filter is optional. Without limit, the whole history is returned
// (as before), so existing callers keep working.
export class ListHistoryQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(HISTORY_ENTRY_TYPES)
  type?: (typeof HISTORY_ENTRY_TYPES)[number];

  @IsOptional()
  @Transform(trimToUndefined)
  @IsDateString()
  from?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsDateString()
  to?: string;

  // A user id.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  author?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_HISTORY_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
