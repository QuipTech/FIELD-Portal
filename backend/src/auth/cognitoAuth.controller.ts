import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CognitoAuthService } from './cognitoAuth.service';
import { CognitoAuthGuard } from './guards/cognitoAuth.guard';
import { CurrentCognitoIdentity } from './decorators/cognitoIdentity.decorator';
import { CognitoIdentity } from './types/cognitoIdentity';
import { SyncCognitoDto } from './dto/syncCognitoDto';

@Controller('auth')
export class CognitoAuthController {
  constructor(private readonly cognitoAuthService: CognitoAuthService) {}

  // Called by the portal's /auth/callback page right after any Cognito
  // sign-in, with the Cognito ID token as the bearer token. A first-time
  // user gets `profileRequired` and calls again with company + phone.
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CognitoAuthGuard)
  sync(
    @CurrentCognitoIdentity() identity: CognitoIdentity,
    @Body() dto: SyncCognitoDto,
  ) {
    return this.cognitoAuthService.syncAndIssueSession(identity, dto);
  }
}
