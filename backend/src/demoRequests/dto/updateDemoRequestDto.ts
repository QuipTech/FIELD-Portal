import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/utils/trimTransforms';
import {
  DEMO_REQUEST_STATUSES,
  DemoRequestStatus,
} from '../types/demoRequestStatus';

// PATCH /admin/demo-requests/:id — status and notes only; anything else in
// the body is refused by the global ValidationPipe (forbidNonWhitelisted).
// Blank notes clear them.
export class UpdateDemoRequestDto {
  @IsOptional()
  @IsIn(DEMO_REQUEST_STATUSES)
  status?: DemoRequestStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
