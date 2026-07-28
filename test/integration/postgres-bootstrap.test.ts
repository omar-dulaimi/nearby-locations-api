import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { buildTestAppPostgres } from '../helpers/build-test-app-postgres.js';
import { createTestDb } from '../helpers/postgres-test-db.js';
import type { FastifyInstance } from 'fastify';
import type { DbHandle } from '../../src/db/connection.js';

let app: FastifyInstance;
let tokens: { reader: string; writer: string };
let probe: DbHandle;

beforeAll(async () => {
  // Reset the DB explicitly via a probe connection (skipReset so the helper doesn't double-truncate).
  probe = createTestDb();
  await probe.db.execute(sql`TRUNCATE TABLE locations`);

  // Build the app; its natural bootstrap should seed from the sample fixture (5 rows).
  const harness = await buildTestAppPostgres({ skipReset: true });
  app = harness.app;
  tokens = harness.tokens;
});

afterAll(async () => {
  await app.close();
  await probe.pool.end();
});

describe('postgres bootstrap', () => {
  it('seeds the locations table from LOCATIONS_FILE when empty', async () => {
    const result = await probe.db.execute<{ c: string }>(
      sql`SELECT COUNT(*)::text AS c FROM locations`,
    );
    expect(Number(result.rows[0]?.c)).toBe(5);
  });

  it('a known seeded id is retrievable via /locations/:id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/51e1545c-8b65-4d83-82f9-7fcad4a23111',
      headers: { authorization: `Bearer ${tokens.reader}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Da Jia Le', radius: 8 });
  });

  it('the GiST index exists on locations.geom', async () => {
    const result = await probe.db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::text AS count
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'locations' AND indexname = 'locations_geom_gix'
    `);
    expect(Number(result.rows[0]?.count)).toBe(1);
  });
});
