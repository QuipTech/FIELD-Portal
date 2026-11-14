import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DeviceSessionService, PairedDevice } from './deviceSession.service';
import {
  CurrentDevice,
  CurrentDeviceToken,
  DeviceTokenGuard,
} from './deviceToken.guard';

// A paired tablet's session over REST, signed in with its device token.
@Controller('mc/device/session')
@UseGuards(DeviceTokenGuard)
export class DeviceSessionController {
  constructor(private readonly sessions: DeviceSessionService) {}

  // On app start: still paired (with the session status), or a 401 to clear
  // the saved pairing.
  @Get()
  get(@CurrentDevice() device: PairedDevice) {
    return this.sessions.describe(device);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentDeviceToken() deviceToken: string) {
    return this.sessions.refreshToken(deviceToken);
  }

  // The tablet's own "remove" button.
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  end(@CurrentDeviceToken() deviceToken: string) {
    return this.sessions.endSession(deviceToken);
  }
}
