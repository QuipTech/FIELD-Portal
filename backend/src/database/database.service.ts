import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { buildPoolConfig } from './buildPoolConfig';

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

  // withTenant plus app.user_id, so database triggers know who made the
  // change (status history, notifications skip the actor).
  withActor = <T>(
    actor: { tenantId: string; userId: string },
    work: (client: PoolClient) => Promise<T>,
  ) =>
    this.withTenant(actor.tenantId, async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true)", [
        actor.userId,
      ]);
      return work(client);
    });

  onModuleDestroy() {
    return this.pool.end();
  }
}
