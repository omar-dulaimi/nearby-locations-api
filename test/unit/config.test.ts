// test/unit/config.test.ts
import { describe, it, expect } from 'vitest';
import { DEV_JWT_SECRET_FALLBACK, loadConfig } from '../../src/config.js';

const base = { JWT_SECRET: 'test-secret' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig({ ...base });
    expect(c.port).toBe(3000);
    expect(c.host).toBe('0.0.0.0');
    expect(c.nodeEnv).toBe('development');
    expect(c.logLevel).toBe('info');
    expect(c.locationsFile).toBe('./data/locations_big.json');
    expect(c.locationsBackend).toBe('memory');
    expect(c.jwtExpiresIn).toBe('1h');
    expect(c.rateLimits.write).toEqual({ max: 20, timeWindow: '1 minute' });
    expect(c.rateLimits.read).toEqual({ max: 120, timeWindow: '1 minute' });
    expect(c.rateLimits.auth).toEqual({ max: 10, timeWindow: '1 minute' });
    expect(c.rateLimits.global).toEqual({ max: 200, timeWindow: '1 minute' });
    expect(c.searchCacheSize).toBe(500);
    expect(c.loadInvalidFractionAbort).toBe(0.5);
    expect(c.users).toHaveLength(2);
    expect(c.users.map((u) => u.role).sort()).toEqual(['reader', 'writer']);
  });

  it('reads overrides', () => {
    const c = loadConfig({
      ...base,
      PORT: '8080',
      LOG_LEVEL: 'debug',
      SEARCH_CACHE_SIZE: '0',
      RATE_LIMIT_WRITE_MAX: '5',
    });
    expect(c.port).toBe(8080);
    expect(c.logLevel).toBe('debug');
    expect(c.searchCacheSize).toBe(0);
    expect(c.rateLimits.write.max).toBe(5);
  });

  it('uses the documented dev fallback JWT secret when JWT_SECRET is unset', () => {
    const c = loadConfig({});
    expect(c.jwtSecret).toBe(DEV_JWT_SECRET_FALLBACK);
  });

  it('requires JWT_SECRET when NODE_ENV=production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('rejects invalid numeric env values', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('parses AUTH_USERS JSON when provided', () => {
    const users = JSON.stringify([{ username: 'alice', role: 'writer', passwordHash: 'aa:bb' }]);
    const c = loadConfig({ ...base, AUTH_USERS: users });
    expect(c.users).toEqual([{ username: 'alice', role: 'writer', passwordHash: 'aa:bb' }]);
  });
});
