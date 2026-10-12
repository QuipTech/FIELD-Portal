import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './authToken.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CognitoAuthController } from './cognitoAuth.controller';
import { CognitoAuthService } from './cognitoAuth.service';
import { CognitoTokenVerifierService } from './cognito/cognitoTokenVerifier.service';
import { CognitoAuthGuard } from './guards/cognitoAuth.guard';
import { PasswordResetService } from './passwordReset/passwordReset.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController, CognitoAuthController],
  providers: [
    AuthService,
    AuthTokenService,
    PasswordResetService,
    JwtStrategy,
    CognitoAuthService,
    CognitoTokenVerifierService,
    CognitoAuthGuard,
  ],
})
export class AuthModule {}
