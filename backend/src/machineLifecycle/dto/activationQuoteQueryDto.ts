import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Bulk activation is capped at 200 machines (lifecycleActionDtos.ts).
export class ActivationQuoteQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  count: number = 1;
}
