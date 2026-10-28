import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { EntitlementsService } from './entitlements.service';
import { FeatureKey } from './featureKeys';

const FEATURE_METADATA = 'requiredFeature';

@Injectable()
export class RequireFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(
      FEATURE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;
    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    await this.entitlements.requireFeature(user.tenantId, feature);
    return true;
  };
}

// The route needs this feature key in the organisation's plan (403
// feature_not_in_plan otherwise). Runs after the controller's JWT guard.
export const RequireFeature = (feature: FeatureKey) =>
  applyDecorators(
    SetMetadata(FEATURE_METADATA, feature),
    UseGuards(RequireFeatureGuard),
  );
