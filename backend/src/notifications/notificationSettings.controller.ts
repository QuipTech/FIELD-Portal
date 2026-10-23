import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  RegisterPushDeviceDto,
  SaveNotificationPreferencesDto,
} from './dto/notificationSettingsDtos';
import { NotificationSettingsService } from './notificationSettings.service';

// The signed-in user's own push devices and notification preferences.
@Controller('me')
@UseGuards(JwtAuthGuard)
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get('devices')
  listDevices(@CurrentUser() actor: AuthenticatedUser) {
    return this.settings.listDevices(actor);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return this.settings.registerDevice(actor, dto);
  }

  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDevice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.settings.removeDevice(actor, deviceId);
  }

  @Get('notification-preferences')
  getPreferences(@CurrentUser() actor: AuthenticatedUser) {
    return this.settings.getPreferences(actor);
  }

  @Put('notification-preferences')
  savePreferences(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SaveNotificationPreferencesDto,
  ) {
    return this.settings.savePreferences(actor, dto);
  }
}
