import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../auth/users.js';
import { unauthorized, forbidden } from '../http/problems.js';

export interface AuthPluginOptions {
  jwtSecret: string;
  jwtExpiresIn: string;
}

async function plugin(app: FastifyInstance, opts: AuthPluginOptions): Promise<void> {
  await app.register(fastifyJwt, {
    secret: opts.jwtSecret,
    sign: { expiresIn: opts.jwtExpiresIn },
  });

  app.decorate(
    'authenticate',
    async function (_req: FastifyRequest, _reply: FastifyReply): Promise<void> {
      try {
        await _req.jwtVerify();
      } catch {
        throw unauthorized('A valid bearer token is required', { instance: _req.url });
      }
    },
  );

  app.decorate('requireRole', function (role: Role) {
    return async function (req: FastifyRequest, _reply: FastifyReply): Promise<void> {
      if (req.user?.role !== role)
        throw forbidden(`Requires the "${role}" role`, { instance: req.url });
    };
  });
}

export const authPlugin = fp(plugin, { name: 'auth' });
