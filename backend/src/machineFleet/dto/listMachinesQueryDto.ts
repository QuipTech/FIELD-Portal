import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';
import {
  OPERATING_STATUSES,
  OperatingStatus,
} from '../types/machineFleetResponse';
import {
  LIFECYCLE_STATES,
  LifecycleState,
} from '../../machineLifecycle/lifecycleTransitions';

// Every filter is optional; blank values count as "any".
export class ListMachinesQueryDto extends PaginationQueryDto {
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

  @IsOptional()
  @Transform(trimToUndefined)
  @IsIn(LIFECYCLE_STATES)
  lifecycleState?: LifecycleState;

  // Only machines the caller is assigned to.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  assignedToMe?: boolean;

  // A model product family, e.g. "Haul truck".
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  machineClass?: string;
}
