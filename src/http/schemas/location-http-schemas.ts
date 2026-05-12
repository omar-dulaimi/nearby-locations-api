import { Type } from '@sinclair/typebox';
import { COORDINATE_PATTERN, RawLocationSchema } from '../../schemas/raw-location.js';
import { UuidStringSchema } from './common.js';

const CoordinateStringSchema = Type.String({ pattern: COORDINATE_PATTERN });

export const SearchQuerySchema = Type.Object(
  { x: Type.Integer({ minimum: 0 }), y: Type.Integer({ minimum: 0 }) },
  { additionalProperties: false },
);

export const SearchResultItemSchema = Type.Object({
  id: UuidStringSchema,
  name: Type.String(),
  coordinates: CoordinateStringSchema,
  distance: Type.Number(),
});

export const SearchResponseSchema = Type.Object({
  'user-location': CoordinateStringSchema,
  locations: Type.Array(SearchResultItemSchema),
});

export const LocationParamsSchema = Type.Object(
  { id: UuidStringSchema },
  { additionalProperties: false },
);

export const DetailResponseSchema = Type.Object({
  name: Type.String(),
  type: Type.String(),
  id: UuidStringSchema,
  'opening-hours': Type.String(),
  image: Type.String(),
  coordinates: CoordinateStringSchema,
  radius: Type.Integer({ minimum: 1 }),
});

// The PUT body is exactly the raw-location wire shape.
export const UpsertBodySchema = RawLocationSchema;
