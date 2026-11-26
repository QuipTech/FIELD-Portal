import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { BIOMETRIC_SIGN_IN_THROTTLER } from '../../auth/biometricKeys/biometricSignInThrottle';
import { DEMO_REQUEST_THROTTLER } from '../../demoRequests/demoRequestsThrottle';
import { readBearerToken } from '../session/deviceToken.guard';
import { RegisterTabletDto, TabletPasswordDto } from './tabletAccess.dtos';
import { TabletAccessService } from './tabletAccess.service';

// A new tablet registering itself: signed out, so limited per IP like pairing.
// `Authorization: Bearer <deviceToken>` is only for a tablet already paired
// with a code.
@Controller('mc/device')
@UseGuards(ThrottlerGuard)
@SkipThrottle({
  [DEMO_REQUEST_THROTTLER.name]: true,
  [BIOMETRIC_SIGN_IN_THROTTLER.name]: true,
})
export class DeviceTabletRegisterController {
  constructor(private readonly tablets: TabletAccessService) {}

  @Post('register')
  register(
    @Body() dto: RegisterTabletDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.tablets.register(dto, readBearerToken(authorization));
  }
}

// A registered tablet, signed in with `Authorization: Bearer <tabletToken>`.
// Not throttled: it polls while waiting to be added to a machine.
@Controller('mc/device/registration')
export class DeviceTabletController {
  constructor(private readonly tablets: TabletAccessService) {}

  @Get()
  get(@Headers('authorization') authorization?: string) {
    return this.tablets.registration(readBearerToken(authorization) ?? '');
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Body() dto: TabletPasswordDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.tablets.changePassword(
      readBearerToken(authorization) ?? '',
      dto,
    );
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  openSession(@Headers('authorization') authorization?: string) {
    return this.tablets.openSession(readBearerToken(authorization) ?? '');
  }
}
