import { Module } from '@nestjs/common';
import { OrganisationBrandingController } from './organisationBranding.controller';
import { BrandingService } from './branding.service';

// StorageService comes from the global StorageModule.
@Module({
  controllers: [OrganisationBrandingController],
  providers: [BrandingService],
})
export class OrganisationBrandingModule {}
