import fp from 'fastify-plugin';
import fastifyEtag from '@fastify/etag';
import type { FastifyInstance } from 'fastify';

async function plugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyEtag, { weak: true });
  app.addHook('onSend', async (req, reply, payload) => {
    const cc = (req.routeOptions.config as { cacheControl?: string } | undefined)?.cacheControl;
    if (cc && !reply.hasHeader('cache-control')) reply.header('cache-control', cc);
    return payload;
  });
}

export const httpCachePlugin = fp(plugin, { name: 'http-cache' });
