import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app } = await buildTestApp();
afterAll(() => app.close());

describe('OpenAPI', () => {
  it('serves the OpenAPI document with all paths and the bearer security scheme', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toMatch(/^3\./);
    for (const p of ['/auth/token', '/locations/search', '/locations/{id}', '/health']) {
      expect(Object.keys(doc.paths), p).toContain(p);
    }
    expect(doc.components?.securitySchemes?.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    // PUT /locations/{id} should declare bearer security.
    expect(doc.paths['/locations/{id}'].put.security).toEqual([{ bearerAuth: [] }]);
  });
  it('serves Swagger UI at /docs', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/' });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'])).toContain('text/html');
  });
});
