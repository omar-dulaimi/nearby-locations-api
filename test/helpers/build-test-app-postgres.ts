// test/helpers/build-test-app-postgres.ts
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { loadConfig, type Config } from '../../src/config.js';
import { buildApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/password.js';
import { createDb } from '../../src/db/connection.js';
import { testDatabaseUrl } from './postgres-test-db.js';
import type { FastifyInstance } from 'fastify';

const SAMPLE = fileURLToPath(new URL('../fixtures/locations.sample.json', import.meta.url));

export interface TestAppOptions {
  env?: Record<string, string | undefined>;
  /** When true, the locations table is NOT truncated/reseeded, which is useful for bootstrap tests that start from an empty DB. */
  skipReset?: boolean;
  /** Override individual config fields after loading (e.g. tiny rate limits). */
  patch?: (c: Config) => void;
}

export interface TestApp {
  app: FastifyInstance;
  config: Config;
  tokens: { reader: string; writer: string };
  passwords: { reader: string; writer: string };
}

export async function buildTestAppPostgres(opts: TestAppOptions = {}): Promise<TestApp> {
  const databaseUrl = testDatabaseUrl();

  // Optionally reset the locations table before bringing the app up.
  if (!opts.skipReset) {
    const { pool, db } = createDb(databaseUrl);
    try {
      await db.execute(sql`TRUNCATE TABLE locations`);
    } finally {
      await pool.end();
    }
  }

  const readerPw = 'reader-pw';
  const writerPw = 'writer-pw';
  const users = JSON.stringify([
    { username: 'reader', role: 'reader', passwordHash: hashPassword(readerPw) },
    { username: 'writer', role: 'writer', passwordHash: hashPassword(writerPw) },
  ]);
  const env = {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    LOCATIONS_BACKEND: 'postgres',
    DATABASE_URL: databaseUrl,
    LOCATIONS_FILE: SAMPLE,
    AUTH_USERS: users,
    ...opts.env,
  };
  const config = loadConfig(env);
  opts.patch?.(config);

  const app = await buildApp(config, { logger: false });
  await app.ready();

  const tokens = { reader: '', writer: '' };
  if ('jwt' in app) {
    const jwt = (app as unknown as { jwt: { sign: (p: object, o?: object) => string } }).jwt;
    tokens.reader = jwt.sign({ sub: 'reader', role: 'reader' }, { expiresIn: config.jwtExpiresIn });
    tokens.writer = jwt.sign({ sub: 'writer', role: 'writer' }, { expiresIn: config.jwtExpiresIn });
  }

  return { app, config, tokens, passwords: { reader: readerPw, writer: writerPw } };
}
