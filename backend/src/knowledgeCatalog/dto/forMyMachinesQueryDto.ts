import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';
import { PaginationQueryDto } from '../../common/dto/paginationQueryDto';

// GET /me/knowledge/for-my-machines — the whole fleet, or one machine.
export class ForMyMachinesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  machineId?: string;
}
