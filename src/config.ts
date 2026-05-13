import type { UserRecord } from './auth/users.js';
import { defaultUsers, parseUsersFromEnv } from './auth/users.js';

export type RateLimitTier = { max: number; timeWindow: string };

export interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  logLevel: string;
  locationsFile: string;
  locationsBackend: 'memory' | 'postgres';
  jwtSecret: string;
  jwtExpiresIn: string;
  users: UserRecord[];
  rateLimits: {
    write: RateLimitTier;
    read: RateLimitTier;
    auth: RateLimitTier;
    global: RateLimitTier;
  };
  searchCacheSize: number;
  loadInvalidFractionAbort: number;
  databaseUrl: string | undefined;
}

type Env = Record<string, string | undefined>;

function str(env: Env, key: string, dflt: string): string {
  const v = env[key];
  return v === undefined || v === '' ? dflt : v;
}
function int(env: Env, key: string, dflt: number): number {
  const v = env[key];
  if (v === undefined || v === '') return dflt;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`Invalid integer for ${key}: ${JSON.stringify(v)}`);
  return n;
}
function num(env: Env, key: string, dflt: number): number {
  const v = env[key];
  if (v === undefined || v === '') return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${key}: ${JSON.stringify(v)}`);
  return n;
}
function tier(env: Env, prefix: string, max: number, win: string): RateLimitTier {
  return { max: int(env, `${prefix}_MAX`, max), timeWindow: str(env, `${prefix}_WINDOW`, win) };
}

export function loadConfig(env: Env): Config {
  const nodeEnv = str(env, 'NODE_ENV', 'development');
  const secretFromEnv = env['JWT_SECRET'];
  if (nodeEnv === 'production' && (secretFromEnv === undefined || secretFromEnv === '')) {
    throw new Error('JWT_SECRET is required when NODE_ENV=production');
  }
  const backend = str(env, 'LOCATIONS_BACKEND', 'memory');
  if (backend !== 'memory' && backend !== 'postgres') {
    throw new Error(
      `LOCATIONS_BACKEND must be "memory" or "postgres", got ${JSON.stringify(backend)}`,
    );
  }
  const users = env['AUTH_USERS'] ? parseUsersFromEnv(env['AUTH_USERS']) : defaultUsers();

  return {
    port: int(env, 'PORT', 3000),
    host: str(env, 'HOST', '0.0.0.0'),
    nodeEnv,
    logLevel: str(env, 'LOG_LEVEL', 'info'),
    locationsFile: str(env, 'LOCATIONS_FILE', './data/locations_big.json'),
    locationsBackend: backend,
    jwtSecret:
      secretFromEnv && secretFromEnv !== '' ? secretFromEnv : 'dev-insecure-secret-change-me',
    jwtExpiresIn: str(env, 'JWT_EXPIRES_IN', '1h'),
    users,
    rateLimits: {
      write: tier(env, 'RATE_LIMIT_WRITE', 20, '1 minute'),
      read: tier(env, 'RATE_LIMIT_READ', 120, '1 minute'),
      auth: tier(env, 'RATE_LIMIT_AUTH', 10, '1 minute'),
      global: tier(env, 'RATE_LIMIT_GLOBAL', 200, '1 minute'),
    },
    searchCacheSize: int(env, 'SEARCH_CACHE_SIZE', 500),
    loadInvalidFractionAbort: num(env, 'LOAD_INVALID_FRACTION_ABORT', 0.5),
    databaseUrl:
      env['DATABASE_URL'] && env['DATABASE_URL'] !== '' ? env['DATABASE_URL'] : undefined,
  };
}
