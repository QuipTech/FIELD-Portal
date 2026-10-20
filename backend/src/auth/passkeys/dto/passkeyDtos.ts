import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

// `response` is the browser's WebAuthn result, passed through as-is: its
// structure and signature are checked by @simplewebauthn/server.
export class FinishPasskeyRegistrationDto {
  @IsUUID()
  challengeId: string;

  @IsObject()
  response: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class FinishPasskeySignInDto {
  @IsUUID()
  challengeId: string;

  @IsObject()
  response: AuthenticationResponseJSON;
}
