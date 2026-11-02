import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;
const HEX_COLOUR_MESSAGE = 'colour must be a hex colour like #4A34C7';

// Blank or null clears an optional field.
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const isSet = (_dto: unknown, value: unknown) =>
  value !== null && value !== undefined;

// POST /machine-groups. Only the name is required; it's unique in the
// organisation, ignoring case.
export class CreateMachineGroupDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @Matches(HEX_COLOUR, { message: HEX_COLOUR_MESSAGE })
  colour?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(200)
  contactName?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(50)
  contactPhone?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

// PATCH /machine-groups/:id — only the fields sent change; null clears an
// optional field. The name can't be cleared.
export class UpdateMachineGroupDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @Matches(HEX_COLOUR, { message: HEX_COLOUR_MESSAGE })
  colour?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(200)
  contactName?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(50)
  contactPhone?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

// DELETE /machine-groups/:id?force=true — force confirms ungrouping the
// group's machines; without it a group that has machines is a 409.
export class DeleteMachineGroupQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  force?: boolean;
}
