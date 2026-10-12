import { readFileSync } from 'fs';
import { join } from 'path';

// Node doesn't ship Amazon's RDS CA in its trusted root store, so
// sslmode=verify-full fails ("self-signed certificate in certificate
// chain") without this explicit bundle — psql/libpq have the same
// requirement, which is why db/migrations' README points at the same file.
const RDS_CA_BUNDLE_PATH = join(__dirname, '../../certs/rdsGlobalBundle.pem');
const VERIFIED_SSL_MODES = ['verify-full', 'verify-ca'];

// pg-connection-string parses sslmode out of the URL itself and that
// takes priority over an `ssl` option passed alongside `connectionString`
// — so to supply our own CA, sslmode has to be stripped from the string
// first, or pg silently ignores the `ca` we pass below.
export const buildPoolConfig = (rawConnectionString: string) => {
  const sslMode = /[?&]sslmode=([^&]*)/.exec(rawConnectionString)?.[1];
  if (!sslMode || !VERIFIED_SSL_MODES.includes(sslMode)) {
    return { connectionString: rawConnectionString };
  }
  return {
    connectionString: rawConnectionString
      .replace(/([?&])sslmode=[^&]*&?/, '$1')
      .replace(/[?&]$/, ''),
    ssl: {
      ca: readFileSync(RDS_CA_BUNDLE_PATH, 'utf8'),
      rejectUnauthorized: true,
    },
  };
};
