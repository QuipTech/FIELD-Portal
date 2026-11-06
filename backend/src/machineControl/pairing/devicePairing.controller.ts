import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { BIOMETRIC_SIGN_IN_THROTTLER } from '../../auth/biometricKeys/biometricSignInThrottle';
import { DEMO_REQUEST_THROTTLER } from '../../demoRequests/demoRequestsThrottle';
import { PairDeviceDto } from './machineAppPairing.dtos';
import { MachineAppPairingService } from './machineAppPairing.service';

// The tablet's side: signed out, so the code is its only proof, and limited
// per IP (devicePairingThrottle.ts).
@Controller('mc/device')
@UseGuards(ThrottlerGuard)
@SkipThrottle({
  [DEMO_REQUEST_THROTTLER.name]: true,
  [BIOMETRIC_SIGN_IN_THROTTLER.name]: true,
})
export class DevicePairingController {
  constructor(private readonly pairing: MachineAppPairingService) {}

  @Post('pair')
  pair(@Body() dto: PairDeviceDto) {
    return this.pairing.pairDevice(dto);
  }
}
