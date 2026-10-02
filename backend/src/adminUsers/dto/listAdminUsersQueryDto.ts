import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsUUID,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Blank strings count as "no filter", so `?search=` behaves like no param.
const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

export class ListAdminUsersQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  role?: string;

  // Narrows the Owner's list to one organisation. Ignored for anyone whose
  // scope is already one organisation, who only ever
  // sees their own.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  organisationId?: string;

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
  pageSize: number = 50;
}
