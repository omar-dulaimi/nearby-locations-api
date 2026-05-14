import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Coordinates } from '../domain/coordinates.js';
import type { Location } from '../domain/location.js';
import type { IndexHit, LocationIndex } from './location-index.js';

interface SearchRow extends Record<string, unknown> {
  id: string;
  name: string;
  type: string;
  opening_hours: string;
  image: string;
  x: number;
  y: number;
  radius: number;
  distance: number;
}

export class PostgresLocationIndex implements LocationIndex {
  readonly needsBootstrap = false;

  constructor(private readonly db: NodePgDatabase) {}

  // PostgreSQL maintains the GiST index on `locations.geom` automatically as rows change.
  // These methods exist to satisfy the LocationIndex interface; the work happens in the DB itself.
  async bulkLoad(_locations: Location[]): Promise<void> {
    /* no-op */
  }
  async upsert(_location: Location): Promise<void> {
    /* no-op */
  }
  async remove(_id: string): Promise<void> {
    /* no-op */
  }

  async size(): Promise<number> {
    const result = await this.db.execute<{ c: string }>(
      sql`SELECT COUNT(*)::text AS c FROM locations`,
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  async search(point: Coordinates): Promise<IndexHit[]> {
    // Two-clause query so PostGIS can use the functional GiST index on
    // ST_Expand(geom, radius) — see drizzle/migrations/0001_reach_index.sql.
    // `&&` is the bbox-overlap operator (GiST-indexable); ST_DWithin stays
    // as the exact recheck on the small candidate set.
    const result = await this.db.execute<SearchRow>(sql`
      SELECT id, name, type, opening_hours, image, x, y, radius,
             ST_Distance(geom, ST_MakePoint(${point.x}, ${point.y})) AS distance
      FROM locations
      WHERE ST_Expand(geom, radius) && ST_MakePoint(${point.x}, ${point.y})
        AND ST_DWithin(geom, ST_MakePoint(${point.x}, ${point.y}), radius)
    `);
    return result.rows.map(rowToHit);
  }
}

function rowToHit(row: SearchRow): IndexHit {
  return {
    location: {
      id: row.id,
      name: row.name,
      type: row.type,
      openingHours: row.opening_hours,
      image: row.image,
      coordinates: { x: Number(row.x), y: Number(row.y) },
      radius: Number(row.radius),
    },
    distance: Number(row.distance),
  };
}
