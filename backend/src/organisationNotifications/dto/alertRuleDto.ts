import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import {
  ALERT_AUDIENCES,
  ALERT_CHANNELS,
  AlertAudience,
  AlertChannel,
} from '../alertTriggerCatalog';

// The whole rule, for create and replace. triggerParams is checked against
// the trigger catalog in alertRuleRules.ts.
export class AlertRuleDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(64)
  triggerType: string;

  @IsOptional()
  @IsObject()
  triggerParams: Record<string, unknown> = {};

  @IsArray()
  @ArrayMinSize(1, { message: 'Choose who to notify.' })
  @ArrayMaxSize(ALERT_AUDIENCES.length)
  @ArrayUnique()
  @IsIn(ALERT_AUDIENCES.map((audience) => audience.value), { each: true })
  audiences: AlertAudience[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one channel.' })
  @ArrayMaxSize(ALERT_CHANNELS.length)
  @ArrayUnique()
  @IsIn(ALERT_CHANNELS.map((channel) => channel.value), { each: true })
  channels: AlertChannel[];

  @IsOptional()
  @IsBoolean()
  isEnabled: boolean = true;
}

export class SetAlertRuleEnabledDto {
  @IsBoolean()
  isEnabled: boolean;
}
