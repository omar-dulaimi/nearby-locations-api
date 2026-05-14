import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/db/connection.js';

let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withUsername('locations')
    .withPassword('locations')
    .withDatabase('locations')
    .start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL_TEST = url;

  // Apply migrations once, so every test file inherits a migrated schema.
  const { pool, db } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: 'drizzle/migrations' });
  } finally {
    await pool.end();
  }
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
