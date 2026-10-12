import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { buildPoolConfig } from './buildPoolConfig';

// A second pool, connected as the service role (field_service): the only
// role that can write the platform/app schemas or touch billing at all
// (migration 0046). Use it only from the billing module, background jobs
// and demo requests (platform-wide leads no tenant may read, 0066) —
// other request handling stays on DatabaseService (the tenant role).
@Injectable()
export class ServiceDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(ServiceDatabaseService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const serviceUrl = configService.get<string>('SERVICE_DATABASE_URL');
    if (!serviceUrl) {
      this.logger.warn(
        'SERVICE_DATABASE_URL is not set: using DATABASE_URL for service-role work. Set it to the field_service role outside local dev.',
      );
    }
    this.pool = new Pool(
      buildPoolConfig(
        serviceUrl || configService.getOrThrow<string>('DATABASE_URL'),
      ),
    );
  }

  query = <T extends QueryResultRow>(text: string, params: unknown[] = []) =>
    this.pool.query<T>(text, params);

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

  onModuleDestroy() {
    return this.pool.end();
  }
}
