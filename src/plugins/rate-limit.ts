import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import { tooManyRequests } from '../http/problems.js';

export interface RateLimitPluginOptions {
  config: Config;
}

function keyFor(req: FastifyRequest): string {
  // Authenticated routes are keyed by the token subject; everything else (incl. /auth/token) by IP.
  // (The rate-limit check runs at onRequest, before body parsing, so the request body isn't available
  // here to fold a submitted username into the key; IP keying is the standard, conservative choice.)
  const user = (req as { user?: { sub?: string } }).user?.sub;
  return user ? `user:${user}` : `ip:${req.ip}`;
}

async function plugin(app: FastifyInstance, opts: RateLimitPluginOptions): Promise<void> {
  const { rateLimits } = opts.config;

  // Per-route overrides: translate `config.rateLimitTier` into `config.rateLimit` BEFORE
  // @fastify/rate-limit registers its own onRoute hook (which reads config.rateLimit).
  app.addHook('onRoute', (route) => {
    const tier = (route.config as { rateLimitTier?: keyof typeof rateLimits } | undefined)
      ?.rateLimitTier;
    if (!tier || tier === 'global') return;
    const t = rateLimits[tier];
    route.config = {
      ...route.config,
      rateLimit: { max: t.max, timeWindow: t.timeWindow, keyGenerator: keyFor },
    };
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: rateLimits.global.max,
    timeWindow: rateLimits.global.timeWindow,
    keyGenerator: keyFor,
    errorResponseBuilder: (req, ctx) => {
      // Return the Problem instance; Fastify's error handler recognises it via instanceof check
      // and sends it as application/problem+json with status 429.
      return tooManyRequests(`Rate limit exceeded. Try again in ${Math.ceil(ctx.ttl / 1000)}s`, {
        instance: req.url,
      });
    },
  });

  // Ensure 429 bodies are sent as application/problem+json.
  app.addHook('onSend', async (_req, reply, payload) => {
    if (reply.statusCode === 429) reply.header('content-type', 'application/problem+json');
    return payload;
  });
}

export const rateLimitPlugin = fp(plugin, { name: 'rate-limit' });
