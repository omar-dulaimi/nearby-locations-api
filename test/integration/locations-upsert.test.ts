import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app, tokens } = await buildTestApp();
afterAll(() => app.close());
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const NEW_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const body = (id: string, coords = 'x=4,y=2', radius = 3) => ({
  name: 'New Place',
  type: 'Restaurant',
  id,
  'opening-hours': '09:00AM-09:00PM',
  image: 'https://example.com/x',
  coordinates: coords,
  radius,
});

describe('PUT /locations/:id', () => {
  it('creates a new location (201 + Location header + detail body) and it becomes searchable', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/locations/${NEW_ID}`,
      headers: auth(tokens.writer),
      payload: body(NEW_ID),
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers.location).toBe(`/locations/${NEW_ID}`);
    expect(res.json()).toEqual({
      name: 'New Place',
      type: 'Restaurant',
      id: NEW_ID,
      'opening-hours': '09:00AM-09:00PM',
      image: 'https://example.com/x',
      coordinates: 'x=4,y=2',
      radius: 3,
    });
    // It is now returned by GET /locations/:id ...
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/locations/${NEW_ID}`,
          headers: auth(tokens.reader),
        })
      ).statusCode,
    ).toBe(200);
    // ... and by a search at its coordinates (reindex works).
    const search = await app.inject({
      method: 'GET',
      url: '/locations/search?x=4&y=2',
      headers: auth(tokens.reader),
    });
    expect(search.json().locations.map((l: { id: string }) => l.id)).toContain(NEW_ID);
  });
  it('replaces an existing location (200)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/locations/${NEW_ID}`,
      headers: auth(tokens.writer),
      payload: body(NEW_ID, 'x=100,y=100', 1),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().coordinates).toBe('x=100,y=100');
  });
  it('rejects a body id that does not match the URL id (400 problem)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/locations/${NEW_ID}`,
      headers: auth(tokens.writer),
      payload: body('99999999-9999-4999-8999-999999999999'),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ status: 400, title: 'Bad Request' });
  });
  it('rejects a malformed body (400 problem)', async () => {
    const bad = { ...body(NEW_ID), radius: 0 };
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/locations/${NEW_ID}`,
          headers: auth(tokens.writer),
          payload: bad,
        })
      ).statusCode,
    ).toBe(400);
    const bad2 = { ...body(NEW_ID), coordinates: 'x=1' };
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/locations/${NEW_ID}`,
          headers: auth(tokens.writer),
          payload: bad2,
        })
      ).statusCode,
    ).toBe(400);
  });
  it('requires a token (401) and the writer role (403)', async () => {
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/locations/${NEW_ID}`,
          payload: body(NEW_ID),
        })
      ).statusCode,
    ).toBe(401);
    const forbidden = await app.inject({
      method: 'PUT',
      url: `/locations/${NEW_ID}`,
      headers: auth(tokens.reader),
      payload: body(NEW_ID),
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ status: 403, title: 'Forbidden' });
  });
});
