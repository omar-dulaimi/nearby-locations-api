// test/integration/smoke.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app, passwords } = await buildTestApp();
afterAll(() => app.close());

describe('end-to-end', () => {
  it('token -> search -> detail -> upsert -> search again', async () => {
    // 1. Get a writer token via the credentials endpoint.
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'writer', password: passwords.writer },
    });
    expect(tokenRes.statusCode).toBe(200);
    const token = tokenRes.json().access_token as string;
    const h = { authorization: `Bearer ${token}` };

    // 2. Search at (3,2) -> R2, R4, and Da Jia Le from the sample fixture.
    // R2(2,2,r2) d=1; R4(2,3,r5) d≈1.41421; Da Jia Le(8,8,r8) d≈7.81025 ≤ 8.
    const s1 = await app.inject({ method: 'GET', url: '/locations/search?x=3&y=2', headers: h });
    expect(s1.json().locations.map((l: { name: string }) => l.name)).toEqual([
      'R2',
      'R4',
      'Da Jia Le',
    ]);

    // 3. Detail for an existing id.
    const d = await app.inject({
      method: 'GET',
      url: '/locations/51e1545c-8b65-4d83-82f9-7fcad4a23111',
      headers: h,
    });
    expect(d.json()).toMatchObject({ name: 'Da Jia Le', radius: 8 });

    // 4. Create a new location near (3,2).
    const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const put = await app.inject({
      method: 'PUT',
      url: `/locations/${id}`,
      headers: h,
      payload: {
        name: 'Newbie',
        type: 'Restaurant',
        id,
        'opening-hours': 'h',
        image: 'https://x',
        coordinates: 'x=3,y=2',
        radius: 1,
      },
    });
    expect(put.statusCode).toBe(201);

    // 5. Search again — the new one shows up first (distance 0).
    const s2 = await app.inject({ method: 'GET', url: '/locations/search?x=3&y=2', headers: h });
    const items = s2.json().locations;
    expect(items[0]).toMatchObject({ id, distance: 0 });
    expect(items.map((l: { name: string }) => l.name)).toEqual(['Newbie', 'R2', 'R4', 'Da Jia Le']);

    // 6. Unauthenticated and wrong-role checks.
    expect((await app.inject({ method: 'GET', url: '/locations/search?x=1&y=1' })).statusCode).toBe(
      401,
    );
    const readerTokenRes = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'reader', password: passwords.reader },
    });
    const readerToken = readerTokenRes.json().access_token as string;
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/locations/${id}`,
          headers: { authorization: `Bearer ${readerToken}` },
          payload: {
            name: 'x',
            type: 'Restaurant',
            id,
            'opening-hours': 'h',
            image: 'https://x',
            coordinates: 'x=1,y=1',
            radius: 1,
          },
        })
      ).statusCode,
    ).toBe(403);
  });
});
