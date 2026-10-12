import { IsIn } from 'class-validator';
import { REPORT_TYPES, ReportType } from '../types/reportType';

export class ReportTypeParamDto {
  @IsIn(REPORT_TYPES)
  reportType: ReportType;
}
