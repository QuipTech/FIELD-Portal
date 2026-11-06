import { IsIn, IsOptional } from 'class-validator';

// POST …/portal-session. 'app' sends the customer back to the mobile app
// (through the portal's /app-return/billing page) instead of the website.
export class PortalSessionDto {
  @IsOptional()
  @IsIn(['portal', 'app'])
  returnTo?: 'portal' | 'app';
}
