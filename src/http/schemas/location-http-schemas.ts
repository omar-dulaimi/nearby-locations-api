import { Type } from '@sinclair/typebox';
import { COORDINATE_PATTERN, RawLocationSchema } from '../../schemas/raw-location.js';
import { UuidStringSchema } from './common.js';

const CoordinateStringSchema = Type.String({ pattern: COORDINATE_PATTERN });

// Coordinates are non-negative integers; bound the upper end at the JS safe-integer
// limit so a value AJV still considers an "integer" (e.g. 1e24) can't slip through and
// produce a coordinate string outside the documented "x=N,y=N" form.
const CoordinateValueSchema = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });

export const SearchQuerySchema = Type.Object(
  { x: CoordinateValueSchema, y: CoordinateValueSchema },
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
