import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsTimeZone,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import { REPORT_TYPES, ReportType } from '../types/reportType';
import {
  REPORT_FREQUENCIES,
  ReportFrequency,
} from '../schedules/scheduleTypes';

const toTrimmedLowercaseList = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) =>
        typeof item === 'string' ? item.trim().toLowerCase() : item,
      )
    : value;

// Create and edit both send the whole schedule.
export class ScheduledReportDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsIn(REPORT_TYPES)
  reportType: ReportType;

  @IsIn(REPORT_FREQUENCIES)
  frequency: ReportFrequency;

  // ISO weekday, 1 = Monday.
  @ValidateIf((dto: ScheduledReportDto) => dto.frequency === 'weekly')
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  // Up to 28 so every month has the day.
  @ValidateIf((dto: ScheduledReportDto) => dto.frequency === 'monthly')
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @IsInt()
  @Min(0)
  @Max(23)
  sendHour: number;

  @IsTimeZone()
  timezone: string;

  @Transform(toTrimmedLowercaseList)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  recipients: string[];
}
