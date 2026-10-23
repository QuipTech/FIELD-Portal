import { IsIn, IsString, Length, Matches } from 'class-validator';

export class PersonalPaymentDto {
  @IsString()
  @Length(1, 200)
  line1: string;

  @IsString()
  @Length(1, 100)
  city: string;

  @IsIn(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'])
  state: string;

  @Matches(/^\d{4}$/)
  postalCode: string;
}
