import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import {
  NOTIFICATION_KINDS,
  NotificationKind,
} from '../types/notificationResponse';

export const PUSH_DEVICE_TYPES = ['ios', 'android', 'web'] as const;
export type PushDeviceType = (typeof PUSH_DEVICE_TYPES)[number];

// POST /me/devices — call on every app start and when the token changes.
export class RegisterPushDeviceDto {
  @IsIn(PUSH_DEVICE_TYPES)
  deviceType!: PushDeviceType;

  // The FCM / APNs token.
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  pushToken!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}

// PUT /me/notification-preferences — the whole set each time.
export class SaveNotificationPreferencesDto {
  @IsBoolean()
  pushEnabled!: boolean;

  @IsBoolean()
  emailEnabled!: boolean;

  // Kinds not to push (they still appear in the feed).
  @IsArray()
  @ArrayUnique()
  @IsIn(NOTIFICATION_KINDS, { each: true })
  mutedKinds!: NotificationKind[];
}
