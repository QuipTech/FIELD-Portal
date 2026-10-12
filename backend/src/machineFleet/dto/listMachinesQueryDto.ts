import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import {
  OPERATING_STATUSES,
  OperatingStatus,
} from '../types/machineFleetResponse';

// Every filter is optional; blank values count as "any".
export class ListMachinesQueryDto {
  // Matches asset/fleet/serial number, make, model or site.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  site?: string;

  // A manufacturer id.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  make?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(OPERATING_STATUSES)
  status?: OperatingStatus;

  // A model product family, e.g. "Haul truck".
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  machineClass?: string;
}
