// test/unit/problems.test.ts
import { describe, it, expect } from 'vitest';
import {
  Problem,
  badRequest,
  notFound,
  unauthorized,
  forbidden,
  tooManyRequests,
  internal,
  problemFromError,
} from '../../src/http/problems.js';

describe('problem factories', () => {
  it('build Problem instances with the documented fields', () => {
    const p = notFound('No location with id abc', { instance: '/locations/abc' });
    expect(p).toBeInstanceOf(Problem);
    expect(p.toJSON()).toEqual({
      type: '/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'No location with id abc',
      instance: '/locations/abc',
    });
  });
  it('include extension members when given', () => {
    const p = badRequest('Validation failed', {
      instance: '/x',
      extensions: { errors: [{ field: 'x', message: 'required' }] },
    });
    expect(p.toJSON()).toMatchObject({ status: 400, errors: [{ field: 'x', message: 'required' }] });
  });
  it('cover the common statuses', () => {
    expect(unauthorized('nope').status).toBe(401);
    expect(forbidden('nope').status).toBe(403);
    expect(tooManyRequests('slow down').status).toBe(429);
    expect(internal().status).toBe(500);
  });
});

describe('problemFromError', () => {
  it('passes Problem instances through', () => {
    const p = notFound('x');
    expect(problemFromError(p, 'req-1')).toBe(p);
  });
  it('maps a Fastify validation error to a 400 with an errors member', () => {
    const err = Object.assign(new Error('body must have required property name'), {
      validation: [{ instancePath: '/name', message: 'is required', keyword: 'required', params: {} }],
      validationContext: 'body',
    });
    const p = problemFromError(err, 'req-1', '/locations/abc');
    expect(p.status).toBe(400);
    expect(p.title).toBe('Bad Request');
    expect(p.toJSON()).toMatchObject({
      status: 400,
      instance: '/locations/abc',
      errors: [{ field: 'body/name', message: 'is required' }],
    });
  });
  it('wraps a generic error with a statusCode', () => {
    const err = Object.assign(new Error('teapot'), { statusCode: 418 });
    const p = problemFromError(err, 'req-1');
    expect(p.status).toBe(418);
  });
  it('maps an unknown error to a 500 (no internal detail leaked)', () => {
    const p = problemFromError(new Error('kaboom secret stack'), 'req-1');
    expect(p.status).toBe(500);
    expect(p.toJSON().detail).not.toContain('secret');
  });
});
