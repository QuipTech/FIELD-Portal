import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// PATCH /machines/:machineId — only the fields sent change. Identifiers
// (serial, fleet, Plant ID) go through PATCH …/identifiers, which needs a
// reason; status through PATCH …/status.
export class UpdateMachineDto {
  // null or blank clears it.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(100)
  site?: string | null;

  // A new hour-meter reading; also stamps when it was read.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  operatingHours?: number;

  // One of the machine's gallery photos; null goes back to the newest.
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  coverPhotoId?: string | null;
}
