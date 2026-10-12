import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectDocumentDto {
  // A missing reason becomes '' so only the "give a reason" rule fails,
  // rather than every rule at once.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value ?? ''),
  )
  @IsString({ message: 'Give a reason for rejecting.' })
  @IsNotEmpty({ message: 'Give a reason for rejecting.' })
  @MaxLength(1000, { message: 'Keep the reason under 1000 characters.' })
  reason: string = '';
}
