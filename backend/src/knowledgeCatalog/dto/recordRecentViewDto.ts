import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

// POST /me/knowledge/recent — call on open and as the reader turns pages.
export class RecordRecentViewDto {
  @IsUUID()
  documentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
