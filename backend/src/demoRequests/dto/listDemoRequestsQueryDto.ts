import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import {
  DEMO_REQUEST_STATUSES,
  DemoRequestStatus,
} from '../types/demoRequestStatus';

// GET /admin/demo-requests — newest first.
export class ListDemoRequestsQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(DEMO_REQUEST_STATUSES)
  status?: DemoRequestStatus;

  // Matches first/last/full name, email or company.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}
