import { readFileSync } from 'fs';
import { join } from 'path';

// The database the *.db-spec.ts suites run against (npm run test:db):
// DATABASE_URL, else the one in .env.$DB_TEST_ENV (default development —
// Jest sets NODE_ENV to "test", so it can't be used). Must be the
// migration owner, so tests can create fixtures and SET ROLE.
export const readDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = join(
    __dirname,
    '..',
    `.env.${process.env.DB_TEST_ENV ?? 'development'}`,
  );
  const line = readFileSync(envFile, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith('DATABASE_URL='));
  if (!line) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return line.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
};
