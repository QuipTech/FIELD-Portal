import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwtAuthGuard';
import { CurrentUser } from '../decorators/currentUser.decorator';
import { AuthenticatedUser } from '../types/authenticatedUser';
import { BiometricKeyRegistrationService } from './biometricKeyRegistration.service';
import { RegisterBiometricKeyDto } from './dto/biometricKeyDtos';

// The signed-in user's phones with fingerprint / Face ID sign-in on.
@Controller('me/biometric-keys')
@UseGuards(JwtAuthGuard)
export class BiometricKeysController {
  constructor(private readonly registration: BiometricKeyRegistrationService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.registration.list(actor);
  }

  @Post()
  register(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RegisterBiometricKeyDto,
    @Ip() ip: string,
  ) {
    return this.registration.register(actor, dto, ip || null);
  }

  @Delete(':keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('keyId', ParseUUIDPipe) keyId: string,
    @Ip() ip: string,
  ) {
    return this.registration.remove(actor, keyId, ip || null);
  }
}
