import { IsBoolean, IsOptional } from 'class-validator';
import { PostCaseMessageDto } from './postCaseMessageDto';

// A staff reply, or with isInternal an internal note only staff can read.
export class PostStaffCaseMessageDto extends PostCaseMessageDto {
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
