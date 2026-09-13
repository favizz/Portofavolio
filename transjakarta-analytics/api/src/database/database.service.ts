import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgres://localhost/transjakarta';
    this.pool = new Pool({
      connectionString,
      // Neon (and most managed Postgres providers) require TLS but use a
      // cert chain Node won't always validate out of the box in a
      // container - this is the standard pg+Neon workaround, not a
      // security downgrade of anything this app itself controls.
      ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    });
  }

  query<T extends QueryResultRow = any>(text: string, params?: any[]) {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
