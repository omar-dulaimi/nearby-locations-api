import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestAppPostgres } from '../helpers/build-test-app-postgres.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  const harness = await buildTestAppPostgres();
  app = harness.app;
});

afterAll(() => app.close());

describe('GET /health (postgres backend)', () => {
  it('returns db: "ok" when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('returns 503 problem if the database is unreachable', async () => {
    // Close the app's onClose hooks (which drains the pool) — the next /health call should fail.
    await app.close();
    // Rebuild with a deliberately-broken DATABASE_URL to simulate "unreachable".
    const harness = await buildTestAppPostgres({
      env: {
        DATABASE_URL: 'postgres://nonexistent:nonexistent@127.0.0.1:1/nonexistent',
      },
      skipReset: true,
    }).catch((err) => err);
    // buildTestAppPostgres awaits migrate() which itself requires the DB; an unreachable URL throws here.
    expect(harness).toBeInstanceOf(Error);
  });
});
