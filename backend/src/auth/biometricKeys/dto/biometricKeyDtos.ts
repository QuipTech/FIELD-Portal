import { Transform } from 'class-transformer';
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../../common/utils/trimTransforms';

export const BIOMETRIC_KEY_ALGORITHMS = ['ed25519'] as const;
export const BIOMETRIC_DEVICE_TYPES = ['ios', 'android'] as const;

// POST /me/biometric-keys — the phone's public key, never the private one.
export class RegisterBiometricKeyDto {
  @IsIn(BIOMETRIC_KEY_ALGORITHMS)
  algorithm!: (typeof BIOMETRIC_KEY_ALGORITHMS)[number];

  // Raw 32-byte Ed25519 key, standard base64; its length is checked on save.
  @IsBase64()
  publicKey!: string;

  @IsIn(BIOMETRIC_DEVICE_TYPES)
  deviceType!: (typeof BIOMETRIC_DEVICE_TYPES)[number];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}

export class BiometricChallengeDto {
  @IsUUID()
  keyId!: string;
}

export class BiometricVerifyDto {
  @IsUUID()
  keyId!: string;

  @IsUUID()
  challengeId!: string;

  // The 64-byte Ed25519 signature, standard base64.
  @IsBase64()
  signature!: string;
}
