import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app, tokens } = await buildTestApp();
afterAll(() => app.close());
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('GET /locations/:id', () => {
  it('returns the detail view (including radius)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/51e1545c-8b65-4d83-82f9-7fcad4a23111',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      name: 'Da Jia Le',
      type: 'Restaurant',
      id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
      'opening-hours': '10:00AM-11:00PM',
      image: 'https://tinyurl.com',
      coordinates: 'x=8,y=8',
      radius: 8,
    });
  });
  it('rejects a malformed id with 400 (schema)', async () => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/locations/not-a-uuid',
          headers: auth(tokens.reader),
        })
      ).statusCode,
    ).toBe(400);
  });
  it('returns 404 (problem) for a well-formed but unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/locations/11111111-1111-4111-8111-111111111111',
      headers: auth(tokens.reader),
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 404, title: 'Not Found' });
  });
  it('requires a token (401)', async () => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/locations/51e1545c-8b65-4d83-82f9-7fcad4a23111',
        })
      ).statusCode,
    ).toBe(401);
  });
});
