import { Type } from '@sinclair/typebox';

export const ProblemSchema = Type.Object(
  {
    type: Type.String(),
    title: Type.String(),
    status: Type.Integer(),
    detail: Type.Optional(Type.String()),
    instance: Type.Optional(Type.String()),
  },
  { additionalProperties: true, $id: 'Problem' },
);

export const UuidStringSchema = Type.String({ format: 'uuid' });
