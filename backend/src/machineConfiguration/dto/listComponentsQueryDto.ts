import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';

export class ListComponentsQueryDto {
  // An installed system id; omitted for every system's components.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsUUID()
  system?: string;
}
