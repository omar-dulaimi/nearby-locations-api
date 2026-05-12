import type { Role } from '../auth/users.js';
import type { onRequestHookHandler } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: onRequestHookHandler;
    requireRole: (role: Role) => onRequestHookHandler;
  }
  // Per-route config keys read by the rate-limit and http-cache plugins.
  interface FastifyContextConfig {
    rateLimitTier?: 'write' | 'read' | 'auth' | 'global';
    cacheControl?: string;
  }
}

export {};
