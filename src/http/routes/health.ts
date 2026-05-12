import type { FastifyInstance } from 'fastify';
import type { LocationService } from '../../service/location-service.js';

export async function healthRoutes(
  app: FastifyInstance,
  opts: { service: LocationService },
): Promise<void> {
  app.get(
    '/health',
    {
      schema: { tags: ['system'] },
      config: { rateLimitTier: 'global', cacheControl: 'public, max-age=10' },
    },
    async () => ({
      status: 'ok',
      locationsLoaded: opts.service.count(),
    }),
  );
}
