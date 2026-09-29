import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const HISTORY_ENTRY_TYPES = [
  'service',
  'repair',
  'inspection',
  'fault',
  'note',
] as const;

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
}
