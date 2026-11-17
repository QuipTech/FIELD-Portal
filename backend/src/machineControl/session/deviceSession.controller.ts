import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Headers,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DeviceSessionService, PairedDevice } from './deviceSession.service';
import {
  CurrentDevice,
  CurrentDeviceToken,
  DeviceTokenGuard,
  readBearerToken,
} from './deviceToken.guard';

// A paired tablet's session over REST, signed in with its device token.
@Controller('mc/device/session')
export class DeviceSessionController {
  constructor(private readonly sessions: DeviceSessionService) {}

  // On app start: still paired (with the session status), or a 401 to clear
  // the saved pairing.
  @Get()
  @UseGuards(DeviceTokenGuard)
  get(@CurrentDevice() device: PairedDevice) {
    return this.sessions.describe(device);
  }

  @Post('refresh')
  @UseGuards(DeviceTokenGuard)
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentDeviceToken() deviceToken: string) {
    return this.sessions.refreshToken(deviceToken);
  }

  // The tablet's own "remove" button.
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  end(@Headers('authorization') authorization?: string) {
    // Validation happens atomically inside mc_end_device_session, which also
    // recognizes a completed request after its credential has been revoked.
    return this.sessions.endSession(readBearerToken(authorization) ?? '');
  }
}
