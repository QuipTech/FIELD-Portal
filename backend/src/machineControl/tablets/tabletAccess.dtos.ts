import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MC_DEVICE_PLATFORMS } from '../pairing/machineAppPairing.dtos';

export const TABLET_PASSWORD_MIN = 8;
export const TABLET_PASSWORD_MAX = 128;

// People type and copy a FIELD ID in groups: "482 915 307".
const FieldId = () => (target: object, property: string) => {
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )(target, property);
  Matches(/^\d{9}$/, { message: 'The FIELD ID is 9 digits.' })(target, property);
};

export class TabletPasswordDto {
  @IsString()
  @MinLength(TABLET_PASSWORD_MIN, {
    message: 'The password must be at least 8 characters.',
  })
  @MaxLength(TABLET_PASSWORD_MAX)
  password!: string;
}

// What a tablet sends to register itself.
export class RegisterTabletDto extends TabletPasswordDto {
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

// A Portal person adding a tablet to a machine. The password was set by the
// tablet, so only its presence is checked here.
export class AddTabletDto {
  @FieldId()
  fieldId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(TABLET_PASSWORD_MAX)
  password!: string;
}

export class ConnectByFieldIdDto extends AddTabletDto {
  // False: view only.
  @IsOptional()
  @IsBoolean()
  control?: boolean;
}
