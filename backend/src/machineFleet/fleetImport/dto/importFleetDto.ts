import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const MAX_IMPORT_ROWS = 1000;

// Cells arrive as the portal read them from the CSV (after its column
// mapping); numbers are accepted as strings. Blank means "not given".
const toCell = ({ value }: { value: unknown }) => {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

// One CSV row. Each row is checked on its own (fleetImportRules) so one
// bad cell is reported against its row instead of failing the request.
export class ImportedMachineDto {
  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  // Make and model as named in the Machine library (ignoring case).
  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(200)
  make?: string;

  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(200)
  model?: string;

  // The customer's Plant ID (asset number).
  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(100)
  plantId?: string;

  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(100)
  site?: string;

  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(20)
  operatingHours?: string;

  // running / down / service due (default running).
  @IsOptional()
  @Transform(toCell)
  @IsString()
  @MaxLength(50)
  status?: string;
}

// POST /machines/import. dryRun checks every row and saves nothing (the
// portal's preview); otherwise every row is saved or, if any row has an
// error, none.
export class ImportFleetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportedMachineDto)
  rows: ImportedMachineDto[];

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;
}
