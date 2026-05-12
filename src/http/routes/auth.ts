import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AuthTokenBodySchema, AuthTokenResponseSchema } from '../schemas/auth-schemas.js';
import { ProblemSchema } from '../schemas/common.js';
import { findUser, type UserRecord } from '../../auth/users.js';
import { verifyPassword } from '../../auth/password.js';
import { unauthorized } from '../problems.js';

export interface AuthRoutesOptions {
  users: UserRecord[];
  jwtExpiresIn: string;
}

export const authRoutes: FastifyPluginAsyncTypebox<AuthRoutesOptions> = async (app, opts) => {
  app.post(
    '/auth/token',
    {
      config: { rateLimitTier: 'auth' },
      schema: {
        tags: ['auth'],
        summary: 'Issue a JWT for the given credentials',
        body: AuthTokenBodySchema,
        response: {
          200: AuthTokenResponseSchema,
          400: ProblemSchema,
          401: ProblemSchema,
          429: ProblemSchema,
        },
      },
    },
    async (req, reply) => {
      const { username, password } = req.body;
      const user = findUser(opts.users, username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw unauthorized('Invalid credentials', { instance: req.url });
      }
      const access_token = await reply.jwtSign(
        { sub: username, role: user.role },
        { expiresIn: opts.jwtExpiresIn },
      );
      const decoded = app.jwt.decode<{ iat: number; exp: number }>(access_token);
      const expires_in = decoded ? decoded.exp - decoded.iat : 0;
      return { access_token, token_type: 'Bearer' as const, expires_in };
    },
  );
};
