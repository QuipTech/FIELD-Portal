import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

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

  // The portal origin to come back to after paying; only a configured
  // PORTAL_ORIGIN is used (see toReturnOrigin).
  @IsOptional()
  @IsString()
  @Length(1, 200)
  returnOrigin?: string;

  // 'app' when paying from the mobile app: Stripe then returns to a portal
  // page that hands back to the app instead of the billing settings page.
  @IsOptional()
  @IsIn(['portal', 'app'])
  returnTo?: 'portal' | 'app';
}
