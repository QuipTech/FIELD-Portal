import { Global, Module } from '@nestjs/common';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { RequireFeatureGuard } from './requireFeature.guard';

// Global so any module can inject EntitlementsService for feature checks.
@Global()
@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, RequireFeatureGuard],
  exports: [EntitlementsService, RequireFeatureGuard],
})
export class EntitlementsModule {}
