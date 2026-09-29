import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const HEX_COLOR_MESSAGE = 'must be a hex colour like #4A34C7';

// Everything but the logo, which has its own upload endpoint. Omitted
// optional fields are cleared (colours fall back to the FIELD defaults).
export class UpdateBrandingDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: `primaryColor ${HEX_COLOR_MESSAGE}` })
  primaryColor?: string | null;

  @IsOptional()
  @Matches(HEX_COLOR, { message: `accentColor ${HEX_COLOR_MESSAGE}` })
  accentColor?: string | null;

  // Shown on emails and case receipts.
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  supportFooter?: string | null;

  @IsOptional()
  @IsBoolean()
  showWatermark: boolean = false;
}
