import { IsBoolean, IsOptional } from 'class-validator';

// Send any of the three; omitted channels keep their setting.
export class UpdateChannelsDto {
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}
