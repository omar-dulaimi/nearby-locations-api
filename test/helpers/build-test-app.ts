import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/config.js';
import { buildApp } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import type { FastifyInstance } from 'fastify';
import { hashPassword } from '../../src/auth/password.js';

const SAMPLE = fileURLToPath(new URL('../fixtures/locations.sample.json', import.meta.url));

export interface TestAppOptions {
  env?: Record<string, string | undefined>;
  /** Override individual config fields after loading (e.g. tiny rate limits). */
  patch?: (c: Config) => void;
}

export interface TestApp {
  app: FastifyInstance;
  config: Config;
  tokens: { reader: string; writer: string };
  passwords: { reader: string; writer: string };
}

export async function buildTestApp(opts: TestAppOptions = {}): Promise<TestApp> {
  const readerPw = 'reader-pw';
  const writerPw = 'writer-pw';
  const users = JSON.stringify([
    { username: 'reader', role: 'reader', passwordHash: hashPassword(readerPw) },
    { username: 'writer', role: 'writer', passwordHash: hashPassword(writerPw) },
  ]);
  const env = {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret',
    LOCATIONS_FILE: SAMPLE,
    AUTH_USERS: users,
    ...opts.env,
  };
  const config = loadConfig(env);
  opts.patch?.(config);
  const app = await buildApp(config, { logger: false });
  await app.ready();

  // Mint tokens directly via the jwt decorator (available after `ready()` once the auth plugin is registered).
  // Until the auth plugin exists, these will be empty strings; integration tests that need them run in later phases.
  const tokens = { reader: '', writer: '' };
  if ('jwt' in app) {
    const jwt = (app as unknown as { jwt: { sign: (p: object, o?: object) => string } }).jwt;
    tokens.reader = jwt.sign({ sub: 'reader', role: 'reader' }, { expiresIn: config.jwtExpiresIn });
    tokens.writer = jwt.sign({ sub: 'writer', role: 'writer' }, { expiresIn: config.jwtExpiresIn });
  }
  return { app, config, tokens, passwords: { reader: readerPw, writer: writerPw } };
}
