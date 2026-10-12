import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const HISTORY_ENTRY_TYPES = [
  'service',
  'repair',
  'inspection',
  'fault',
  'note',
] as const;

const MAX_DOWNTIME_HOURS = 10_000;

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateHistoryEntryDto {
  @IsIn(HISTORY_ENTRY_TYPES)
  entryType: (typeof HISTORY_ENTRY_TYPES)[number];

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  // One of this machine's installed components.
  @IsOptional()
  @IsUUID()
  componentId?: string;

  // A repair that swapped the component: takes a "component_replaced"
  // configuration snapshot.
  @IsOptional()
  @IsBoolean()
  componentReplaced?: boolean;

  // The hour-meter reading when the work was done.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  operatingHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DOWNTIME_HOURS)
  downtimeHours?: number;
}
