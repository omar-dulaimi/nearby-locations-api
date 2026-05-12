import { Type } from '@sinclair/typebox';

export const AuthTokenBodySchema = Type.Object(
  { username: Type.String({ minLength: 1 }), password: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export const AuthTokenResponseSchema = Type.Object({
  access_token: Type.String(),
  token_type: Type.Literal('Bearer'),
  expires_in: Type.Integer(),
});
