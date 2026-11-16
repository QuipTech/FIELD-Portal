import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../common/utils/trimTransforms';

export class ListMachineControlOrganisationsQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class SetMachineControlDto {
  @IsBoolean()
  enabled!: boolean;
}
