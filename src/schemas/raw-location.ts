import './formats.js'; // registers the 'uuid'/'uri' JSON-Schema formats for any consumer of this schema
import { Type, type Static } from '@sinclair/typebox';
import { parseCoordinates } from '../domain/coordinates.js';
import type { Location } from '../domain/location.js';

export const COORDINATE_PATTERN = '^x=(0|[1-9][0-9]*),y=(0|[1-9][0-9]*)$';

export const RawLocationSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    type: Type.String({ minLength: 1 }),
    id: Type.String({ format: 'uuid' }),
    'opening-hours': Type.String({ minLength: 1 }),
    image: Type.String({ format: 'uri', minLength: 1 }),
    coordinates: Type.String({ pattern: COORDINATE_PATTERN }),
    radius: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false, $id: 'RawLocation' },
);

export type RawLocation = Static<typeof RawLocationSchema>;

export function rawToLocation(raw: RawLocation): Location {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    openingHours: raw['opening-hours'],
    image: raw.image,
    coordinates: parseCoordinates(raw.coordinates),
    radius: raw.radius,
  };
}
