import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// A tablet's access password, kept only as a salted scrypt hash.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const KEY_LENGTH = 32;

export const hashTabletPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
};

export const verifyTabletPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64'),
    expected.length,
  );
  return timingSafeEqual(actual, expected);
};
