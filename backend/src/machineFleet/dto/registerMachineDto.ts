import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trimString, trimToUndefined } from '../../common/utils/trimTransforms';
import {
  OPERATING_STATUSES,
  OperatingStatus,
} from '../types/machineFleetResponse';

// A model from the Machine library; its make comes with it.
export class RegisterMachineDto {
  @IsUUID()
  modelId: string;

  // Unique within the organisation.
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  serialNumber: string;

  // e.g. "HT-2201"; shown in place of the serial when set.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  assetNumber?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  site?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  operatingHours?: number;

  @IsOptional()
  @IsIn(OPERATING_STATUSES)
  status?: OperatingStatus;
}
