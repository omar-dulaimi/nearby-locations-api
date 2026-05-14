import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface DbHandle {
  pool: pg.Pool;
  db: NodePgDatabase;
}

export function createDb(databaseUrl: string): DbHandle {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  const db = drizzle(pool);
  return { pool, db };
}
