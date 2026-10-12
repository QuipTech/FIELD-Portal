import { IsEmail } from 'class-validator';

export class PasswordResetCheckDto {
  @IsEmail()
  email: string;
}
