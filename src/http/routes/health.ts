import type { FastifyInstance } from 'fastify';
import type { LocationService } from '../../service/location-service.js';
import { unavailable } from '../problems.js';

export interface HealthRoutesOptions {
  service: LocationService;
  /** When provided, /health pings the database; failure → 503 problem. Only set in postgres mode. */
  dbHealth?: () => Promise<boolean>;
}

export async function healthRoutes(app: FastifyInstance, opts: HealthRoutesOptions): Promise<void> {
  app.get('/', { schema: { hide: true } }, (_req, reply) => reply.redirect('/docs', 302));

  app.get(
    '/health',
    {
      schema: { tags: ['system'] },
      config: { rateLimitTier: 'global', cacheControl: 'public, max-age=10' },
    },
    async (req) => {
      if (opts.dbHealth) {
        const ok = await opts.dbHealth();
        if (!ok) throw unavailable('Database is not reachable', { instance: req.url });
        return {
          status: 'ok',
          locationsLoaded: await opts.service.count(),
          db: 'ok' as const,
        };
      }
      return {
        status: 'ok',
        locationsLoaded: await opts.service.count(),
      };
    },
  );
}
