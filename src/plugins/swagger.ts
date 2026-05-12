import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

async function plugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Nearby Locations API',
        version: '1.0.0',
        description: 'Find locations whose service radius reaches a given point.',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'locations', description: 'Location search, detail and upsert' },
        { name: 'auth', description: 'Token issuance' },
        { name: 'system', description: 'Health and meta' },
      ],
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  app.get(
    '/openapi.json',
    {
      schema: { tags: ['system'], summary: 'OpenAPI document' },
      config: { cacheControl: 'public, max-age=60' },
    },
    async () => app.swagger(),
  );
}

export const swaggerPlugin = fp(plugin, { name: 'swagger' });
