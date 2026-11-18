import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const MAX_DESIGN_FILES = 32;
export const MAX_DESIGN_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DESIGN_VERSION_BYTES = 20 * 1024 * 1024;

export interface DesignFile {
  path: string;
  sizeBytes: number;
  sha256: string;
  key: string;
}

export class UploadDesignVersion {
  @IsString()
  @MaxLength(100)
  project!: string;

  @IsString()
  @MaxLength(12_000)
  paths!: string;
}

export class PreviewDesignDelivery {
  @IsUUID()
  versionId!: string;

  @ValidateIf(
    (dto: PreviewDesignDelivery) => !dto.site || dto.machineIds !== undefined,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  machineIds?: string[];

  @ValidateIf(
    (dto: PreviewDesignDelivery) => !dto.machineIds || dto.site !== undefined,
  )
  @IsString()
  @MaxLength(200)
  @Matches(/\S/)
  site?: string;

  @ValidateIf(
    (dto: PreviewDesignDelivery) =>
      dto.site !== undefined || dto.siteTenantId !== undefined,
  )
  @IsUUID()
  siteTenantId?: string;
}

export class SendDesignDelivery extends PreviewDesignDelivery {
  @IsUUID()
  batchId!: string;

  @Matches(/^[a-f0-9]{64}$/)
  previewHash!: string;
}

export class UpdateDesignDelivery {
  @IsIn(['downloading', 'arrived', 'failed'])
  status!: 'downloading' | 'arrived' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  error?: string;
}
