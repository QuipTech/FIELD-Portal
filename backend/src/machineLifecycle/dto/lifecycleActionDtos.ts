import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import {
  DIRECT_LIFECYCLE_ACTIONS,
  LifecycleAction,
} from '../lifecycleTransitions';

const MAX_REASON_LENGTH = 500;
const MAX_BULK_MACHINES = 200;

export class ApplyLifecycleActionDto {
  @IsIn(DIRECT_LIFECYCLE_ACTIONS)
  action: LifecycleAction;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(MAX_REASON_LENGTH)
  reason?: string;
}

export class BulkLifecycleActionDto extends ApplyLifecycleActionDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_MACHINES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  machineIds: string[];
}
