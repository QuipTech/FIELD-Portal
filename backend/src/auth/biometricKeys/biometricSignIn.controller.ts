import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { DEMO_REQUEST_THROTTLER } from '../../demoRequests/demoRequestsThrottle';
import { BiometricSignInService } from './biometricSignIn.service';
import {
  BiometricChallengeDto,
  BiometricVerifyDto,
} from './dto/biometricKeyDtos';

// Signed out: get a challenge for this phone's key, then send its signature.
// Only the biometric limit applies here (biometricSignInThrottle.ts).
@Controller('auth/biometric')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ [DEMO_REQUEST_THROTTLER.name]: true })
export class BiometricSignInController {
  constructor(private readonly signIn: BiometricSignInService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  challenge(@Body() dto: BiometricChallengeDto) {
    return this.signIn.startSignIn(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: BiometricVerifyDto, @Ip() ip: string) {
    return this.signIn.finishSignIn(dto, ip || null);
  }
}
