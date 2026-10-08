import { IsBoolean } from 'class-validator';

export class UpdateSnapshotDto {
  @IsBoolean()
  isKnownGood: boolean;
}
