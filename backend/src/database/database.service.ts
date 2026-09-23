import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';

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
const buildPoolConfig = (rawConnectionString: string) => {
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

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    this.pool = new Pool(
      buildPoolConfig(configService.getOrThrow<string>('DATABASE_URL')),
    );
  }

  query = <T extends QueryResultRow>(text: string, params: unknown[] = []) =>
    this.pool.query<T>(text, params);

  // Runs `work` inside a plain transaction — no tenant context set. Use
  // this for statements that legitimately span tenants, e.g. creating the
  // tenant row itself during registration.
  transaction = async <T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> => {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  // Runs `work` inside a transaction with app.tenant_id set for the
  // duration of that transaction, so RLS policies scope every statement
  // `work` issues to this tenant.
  withTenant = <T>(
    tenantId: string,
    work: (client: PoolClient) => Promise<T>,
  ) =>
    this.transaction(async (client) => {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
      return work(client);
    });

  onModuleDestroy() {
    return this.pool.end();
  }
}
