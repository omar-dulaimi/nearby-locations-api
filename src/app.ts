import Fastify, { type FastifyInstance } from 'fastify';
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { type Config, DEV_JWT_SECRET_FALLBACK } from './config.js';
import { buildLoggerOptions } from './logger.js';
import { loadLocationsFromFile } from './repository/load-locations.js';
import { InMemoryLocationRepository } from './repository/in-memory-location-repository.js';
import { PostgresLocationRepository } from './repository/postgres-location-repository.js';
import type { LocationRepository } from './repository/location-repository.js';
import { GridIndex } from './spatial/grid-index.js';
import { PostgresLocationIndex } from './spatial/postgres-location-index.js';
import type { LocationIndex } from './spatial/location-index.js';
import { SearchCache } from './cache/search-cache.js';
import type { IndexHit } from './spatial/location-index.js';
import { LocationService } from './service/location-service.js';
import { installErrorHandlers } from './http/problems.js';
import { healthRoutes } from './http/routes/health.js';
import { authPlugin } from './plugins/auth.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { httpCachePlugin } from './plugins/http-cache.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { authRoutes } from './http/routes/auth.js';
import { locationsRoutes } from './http/routes/locations.js';
import { createDb } from './db/connection.js';

export interface BuildAppOptions {
  /** Override the logger; tests usually pass `false`. */
  logger?: ReturnType<typeof buildLoggerOptions>;
}

export async function buildApp(
  config: Config,
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? buildLoggerOptions(config.nodeEnv, config.logLevel),
    ajv: { customOptions: { allErrors: true } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  installErrorHandlers(app);

  if (config.jwtSecret === DEV_JWT_SECRET_FALLBACK) {
    app.log.warn(
      'JWT_SECRET is unset, so the insecure dev fallback secret is in use. Set JWT_SECRET in your environment for any non-local use.',
    );
  }

  let repo: LocationRepository;
  let index: LocationIndex;
  let dbHealth: (() => Promise<boolean>) | undefined;

  if (config.locationsBackend === 'memory') {
    const { loaded, total, skipped } = loadLocationsFromFile(config.locationsFile, {
      abortInvalidFraction: config.loadInvalidFractionAbort,
      onWarn: (msg, detail) => app.log.warn({ detail }, msg),
    });
    app.log.info(
      { file: config.locationsFile, total, loaded: loaded.length, skipped },
      'locations loaded',
    );
    repo = new InMemoryLocationRepository(loaded);
    index = new GridIndex();
  } else {
    // postgres mode
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required when LOCATIONS_BACKEND=postgres');
    }
    const { pool, db } = createDb(config.databaseUrl);

    await migrate(db, { migrationsFolder: 'drizzle/migrations' });
    app.log.info('migrations applied');

    const pgRepo = new PostgresLocationRepository(db);
    const existing = await pgRepo.count();
    if (existing === 0) {
      const { loaded, total, skipped } = loadLocationsFromFile(config.locationsFile, {
        abortInvalidFraction: config.loadInvalidFractionAbort,
        onWarn: (msg, detail) => app.log.warn({ detail }, msg),
      });
      await pgRepo.seed(loaded);
      app.log.info(
        {
          file: config.locationsFile,
          total,
          loaded: loaded.length,
          skipped,
          seeded: loaded.length,
        },
        'locations seeded',
      );
    } else {
      app.log.info({ existing }, 'locations table already populated; skipping seed');
    }

    repo = pgRepo;
    index = new PostgresLocationIndex(db);
    dbHealth = async () => {
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    };

    app.addHook('onClose', async () => {
      await pool.end();
    });
  }

  const cache =
    config.searchCacheSize > 0 ? new SearchCache<IndexHit[]>(config.searchCacheSize) : undefined;
  const service = new LocationService(repo, index, cache);
  await service.bootstrap();

  await app.register(swaggerPlugin);
  await app.register(authPlugin, {
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
  });
  await app.register(rateLimitPlugin, { config });
  await app.register(httpCachePlugin);

  await app.register(healthRoutes, { service, ...(dbHealth ? { dbHealth } : {}) });
  await app.register(authRoutes, { users: config.users, jwtExpiresIn: config.jwtExpiresIn });
  await app.register(locationsRoutes, { service });

  return app;
}
