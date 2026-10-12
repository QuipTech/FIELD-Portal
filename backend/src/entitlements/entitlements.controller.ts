import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { EntitlementsService } from './entitlements.service';

// What the signed-in user's organisation may use, so the apps can show or
// hide features. Read from app.entitlements only.
@Controller('organisation/entitlements')
@UseGuards(JwtAuthGuard)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.entitlementsService.listEntitlements(actor.tenantId);
  }
}
