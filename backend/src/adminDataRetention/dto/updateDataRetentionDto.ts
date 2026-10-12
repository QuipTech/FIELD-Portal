import { IsIn } from 'class-validator';
import {
  AI_QUERY_LOG_RETENTION_OPTIONS,
  AiQueryLogRetentionMonths,
} from '../../dataGovernance/dataSchemas.config';

export class UpdateDataRetentionDto {
  @IsIn(AI_QUERY_LOG_RETENTION_OPTIONS, {
    message: `aiQueryLogsMonths must be one of ${AI_QUERY_LOG_RETENTION_OPTIONS.join(', ')}`,
  })
  aiQueryLogsMonths: AiQueryLogRetentionMonths;
}
