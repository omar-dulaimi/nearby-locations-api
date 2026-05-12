import type { Role } from '../auth/users.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: import('fastify').onRequestHookHandler;
    requireRole: (role: Role) => import('fastify').onRequestHookHandler;
  }
  // Per-route config keys read by the rate-limit and http-cache plugins.
  interface FastifyContextConfig {
    rateLimitTier?: 'write' | 'read' | 'auth' | 'global';
    cacheControl?: string;
  }
}

export {};
