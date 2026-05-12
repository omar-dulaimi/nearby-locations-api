import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app, tokens } = await buildTestApp();
afterAll(() => app.close());
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('GET /locations/search', () => {
  it('returns matching locations sorted by distance ascending (worked example)', async () => {
    // Sample fixture: R1(1,1,r1) R2(2,2,r2) R3(5,5,r1) R4(2,3,r5) "Da Jia Le"(8,8,r8).
    // User (3,2) -> R2 (d=1), R4 (d~1.41421), Da Jia Le (d~7.81025, r8 is large enough to reach).
    const res = await app.inject({
      method: 'GET',
      url: '/locations/search?x=3&y=2',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body['user-location']).toBe('x=3,y=2');
    expect(body.locations.map((l: { name: string }) => l.name)).toEqual(['R2', 'R4', 'Da Jia Le']);
    expect(body.locations[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000002',
      name: 'R2',
      coordinates: 'x=2,y=2',
      distance: 1,
    });
    expect(body.locations[1].distance).toBe(1.41421);
    expect(body.locations[2]).toMatchObject({
      id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
      name: 'Da Jia Le',
      coordinates: 'x=8,y=8',
      distance: 7.81025,
    });
  });
  it('returns an empty list (200) when nothing is in range', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/search?x=999999&y=999999',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ 'user-location': 'x=999999,y=999999', locations: [] });
  });
  it('rejects missing/invalid params with a 400 problem (with errors)', async () => {
    for (const url of [
      '/locations/search',
      '/locations/search?x=3',
      '/locations/search?x=3&y=-1',
      '/locations/search?x=1.5&y=2',
      '/locations/search?x=a&y=2',
    ]) {
      const res = await app.inject({ method: 'GET', url, headers: auth(tokens.reader) });
      expect(res.statusCode, url).toBe(400);
      expect(res.json(), url).toMatchObject({ status: 400, errors: expect.any(Array) });
    }
  });
  it('requires a valid token (401 problem)', async () => {
    expect((await app.inject({ method: 'GET', url: '/locations/search?x=3&y=2' })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/locations/search?x=3&y=2',
          headers: auth('bad'),
        })
      ).statusCode,
    ).toBe(401);
  });
});
