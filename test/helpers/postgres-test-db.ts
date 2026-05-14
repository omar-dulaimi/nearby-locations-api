import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDb, type DbHandle } from '../../src/db/connection.js';

/** Resolve the connection URL the globalSetup placed in env. Throws if missing (means globalSetup didn't run). */
export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_URL_TEST is not set; ensure vitest globalSetup ran');
  }
  return url;
}

/** Build a fresh DbHandle pointing at the test container. The caller is responsible for `await pool.end()`. */
export function createTestDb(): DbHandle {
  return createDb(testDatabaseUrl());
}

/** Wipe the `locations` table between tests. */
export async function truncateLocations(db: NodePgDatabase): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE locations`);
}
