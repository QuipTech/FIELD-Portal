import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadGalleryPhotoDto {
  // e.g. "left side, pump bay"; the file name is shown when omitted.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
