import Fastify, { type FastifyInstance } from 'fastify';
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Config } from './config.js';
import { buildLoggerOptions } from './logger.js';
import { loadLocationsFromFile } from './repository/load-locations.js';
import { InMemoryLocationRepository } from './repository/in-memory-location-repository.js';
import type { LocationRepository } from './repository/location-repository.js';
import { GridIndex } from './spatial/grid-index.js';
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

  // --- data + domain wiring (repository is swappable; only "memory" is implemented here) ---
  if (config.locationsBackend !== 'memory') {
    throw new Error(
      `LOCATIONS_BACKEND=${config.locationsBackend} is not implemented in this build`,
    );
  }
  const { loaded, total, skipped } = loadLocationsFromFile(config.locationsFile, {
    abortInvalidFraction: config.loadInvalidFractionAbort,
    onWarn: (msg, detail) => app.log.warn({ detail }, msg),
  });
  app.log.info({ total, loaded: loaded.length, skipped }, 'locations loaded');
  const repo: LocationRepository = new InMemoryLocationRepository(loaded);
  const index = new GridIndex();
  const cache =
    config.searchCacheSize > 0 ? new SearchCache<IndexHit[]>(config.searchCacheSize) : undefined;
  const service = new LocationService(repo, index, cache);
  service.bootstrap();

  // --- plugins ---
  await app.register(swaggerPlugin);
  await app.register(authPlugin, {
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
  });
  await app.register(rateLimitPlugin, { config });
  await app.register(httpCachePlugin);

  // --- routes ---
  await app.register(healthRoutes, { service });
  await app.register(authRoutes, { users: config.users, jwtExpiresIn: config.jwtExpiresIn });
  await app.register(locationsRoutes, { service });

  return app;
}
