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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwtAuthGuard';
import { CurrentUser } from '../decorators/currentUser.decorator';
import { AuthenticatedUser } from '../types/authenticatedUser';
import { PasskeyRegistrationService } from './passkeyRegistration.service';
import { PasskeySignInService } from './passkeySignIn.service';
import {
  FinishPasskeyRegistrationDto,
  FinishPasskeySignInDto,
} from './dto/passkeyDtos';

// Each ceremony is two calls: get options (with a single-use challenge) for
// the browser's WebAuthn prompt, then send back the device's signed answer.
@Controller('auth/passkeys')
export class PasskeysController {
  constructor(
    private readonly registration: PasskeyRegistrationService,
    private readonly signIn: PasskeySignInService,
  ) {}

  @Post('sign-in/options')
  @HttpCode(HttpStatus.OK)
  signInOptions() {
    return this.signIn.startSignIn();
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  finishSignIn(@Body() dto: FinishPasskeySignInDto) {
    return this.signIn.finishSignIn(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.registration.list(actor);
  }

  @Post('registration/options')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  registrationOptions(@CurrentUser() actor: AuthenticatedUser) {
    return this.registration.startRegistration(actor);
  }

  @Post('registration')
  @UseGuards(JwtAuthGuard)
  finishRegistration(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: FinishPasskeyRegistrationDto,
  ) {
    return this.registration.finishRegistration(actor, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.registration.remove(actor, id);
  }
}
