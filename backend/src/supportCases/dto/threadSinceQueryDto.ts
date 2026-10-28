import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

// ?since=<ISO time> on a case's messages and events: only what was added
// (or, for internal notes, edited) after it, for clients that poll instead
// of holding a socket. Pass the latest createdAt/editedAt already shown
// and merge the results by id.
export class ThreadSinceQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  since?: Date;
}
