import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (plainTextPassword: string): Promise<string> =>
  bcrypt.hash(plainTextPassword, SALT_ROUNDS);

export const verifyPassword = (
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> => bcrypt.compare(plainTextPassword, passwordHash);
