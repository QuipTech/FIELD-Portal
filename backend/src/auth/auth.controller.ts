import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refreshTokenDto';
import { PasswordResetCheckDto } from './dto/passwordResetCheckDto';
import { PasswordResetService } from './passwordReset/passwordReset.service';
import { JwtAuthGuard } from './guards/jwtAuthGuard';
import { CurrentUser } from './decorators/currentUser.decorator';
import { AuthenticatedUser } from './types/authenticatedUser';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  // Before the portal asks Cognito for a reset code: does a password login
  // exist for this email? (Cognito alone either errors or, with "prevent
  // user existence errors" on, pretends to send a code.) Reveals whether an
  // email has an account — as signup already does.
  @Post('password-reset/check')
  @HttpCode(HttpStatus.OK)
  checkPasswordReset(@Body() dto: PasswordResetCheckDto) {
    return this.passwordResetService.checkEligibility(dto.email);
  }

  // Sign-up and sign-in (email/password, Google, Apple) all go through
  // Cognito, then POST /auth/sync (CognitoAuthController) issues the FIELD
  // session these routes refresh, end and read.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId, user.tenantId);
  }
}
