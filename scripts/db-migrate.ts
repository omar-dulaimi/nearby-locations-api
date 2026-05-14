import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/db/connection.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL must be set');
  process.exit(1);
}

const { pool, db } = createDb(databaseUrl);
try {
  await migrate(db, { migrationsFolder: 'drizzle/migrations' });
  console.log('migrations applied');
} finally {
  await pool.end();
}
