import { IsOptional, IsUUID } from 'class-validator';

// Omit `against` to compare with the version just before this one.
export class PromptDiffQueryDto {
  @IsOptional()
  @IsUUID()
  against?: string;
}
