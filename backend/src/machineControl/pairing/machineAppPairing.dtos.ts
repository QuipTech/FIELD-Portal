import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const MC_DEVICE_PLATFORMS = ['android', 'windows'] as const;

// What a tablet sends to pair.
export class PairDeviceDto {
  @Matches(/^\d{6}$/, { message: 'The pairing code is 6 digits.' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @IsOptional()
  @IsIn(MC_DEVICE_PLATFORMS)
  platform?: (typeof MC_DEVICE_PLATFORMS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}
