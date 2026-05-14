import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestAppPostgres } from '../helpers/build-test-app-postgres.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let tokens: { reader: string; writer: string };

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

beforeAll(async () => {
  // buildTestAppPostgres truncates `locations` then runs the app's natural bootstrap,
  // which auto-seeds from the sample fixture (5 rows).
  const harness = await buildTestAppPostgres();
  app = harness.app;
  tokens = harness.tokens;
});

afterAll(() => app.close());

describe('GET /locations/search (postgres backend)', () => {
  it('returns matching locations at user (3,2) from the sample fixture', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/search?x=3&y=2',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body['user-location']).toBe('x=3,y=2');
    // Sample fixture has 5 rows; against (3,2) → R2 (d=1), R4 (d=√2 ≈ 1.41421), Da Jia Le (d=√61 ≈ 7.81025).
    expect(body.locations.map((l: { name: string }) => l.name)).toEqual(['R2', 'R4', 'Da Jia Le']);
    expect(body.locations[0].distance).toBe(1);
  });

  it('empty result for an out-of-range point', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/search?x=999999&y=999999',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ 'user-location': 'x=999999,y=999999', locations: [] });
  });

  it('rejects bad params with a 400 problem', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/search?x=-1&y=abc',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ status: 400, errors: expect.any(Array) });
  });

  it('requires a valid token (401 problem)', async () => {
    const res = await app.inject({ method: 'GET', url: '/locations/search?x=3&y=2' });
    expect(res.statusCode).toBe(401);
  });
});
