// test/integration/auth-plugin.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { authPlugin } from '../../src/plugins/auth.js';
import { installErrorHandlers } from '../../src/http/problems.js';

async function makeApp() {
  const app = Fastify();
  installErrorHandlers(app);
  await app.register(authPlugin, { jwtSecret: 'test-secret', jwtExpiresIn: '1h' });
  app.get('/protected', { onRequest: [app.authenticate] }, async (req) => ({
    sub: req.user.sub,
    role: req.user.role,
  }));
  app.put(
    '/writers-only',
    { onRequest: [app.authenticate, app.requireRole('writer')] },
    async () => ({
      ok: true,
    }),
  );
  await app.ready();
  return app;
}
const app = await makeApp();
afterAll(() => app.close());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readerToken = (app as any).jwt.sign({ sub: 'r', role: 'reader' }, { expiresIn: '1h' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const writerToken = (app as any).jwt.sign({ sub: 'w', role: 'writer' }, { expiresIn: '1h' });

describe('auth plugin', () => {
  it('rejects requests without a valid token (401 problem)', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
    const bad = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(bad.statusCode).toBe(401);
  });
  it('accepts a valid token and exposes the claims', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${readerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sub: 'r', role: 'reader' });
  });
  it('requireRole forbids the wrong role (403) and allows the right one', async () => {
    const forbiddenRes = await app.inject({
      method: 'PUT',
      url: '/writers-only',
      headers: { authorization: `Bearer ${readerToken}` },
    });
    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.json()).toMatchObject({ status: 403, title: 'Forbidden' });
    const ok = await app.inject({
      method: 'PUT',
      url: '/writers-only',
      headers: { authorization: `Bearer ${writerToken}` },
    });
    expect(ok.statusCode).toBe(200);
  });
});
