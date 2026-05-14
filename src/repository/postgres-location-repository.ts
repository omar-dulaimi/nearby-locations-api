import { count, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { locations, type LocationRow } from '../db/schema.js';
import type { Location } from '../domain/location.js';
import type { LocationRepository } from './location-repository.js';

export class PostgresLocationRepository implements LocationRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async getById(id: string): Promise<Location | undefined> {
    const rows = await this.db.select().from(locations).where(eq(locations.id, id)).limit(1);
    return rows[0] ? rowToLocation(rows[0]) : undefined;
  }

  async upsert(loc: Location): Promise<void> {
    const values = {
      id: loc.id,
      name: loc.name,
      type: loc.type,
      openingHours: loc.openingHours,
      image: loc.image,
      x: loc.coordinates.x,
      y: loc.coordinates.y,
      radius: loc.radius,
    };
    await this.db
      .insert(locations)
      .values(values)
      .onConflictDoUpdate({ target: locations.id, set: values });
  }

  async all(): Promise<Location[]> {
    const rows = await this.db.select().from(locations);
    return rows.map(rowToLocation);
  }

  async count(): Promise<number> {
    const result = await this.db.select({ c: count() }).from(locations);
    return Number(result[0]?.c ?? 0);
  }

  /** Bulk-insert. Used by the seed-on-empty path; much faster than N individual upserts.
   *  Batched to stay within PostgreSQL's 65535-parameter limit (8 params × 8000 rows = 64000). */
  async seed(rows: Location[]): Promise<void> {
    if (rows.length === 0) return;
    const BATCH_SIZE = 8000; // 8 columns × 8000 = 64000 params, safely under the 65535 pg limit
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = batch.map((loc) => ({
        id: loc.id,
        name: loc.name,
        type: loc.type,
        openingHours: loc.openingHours,
        image: loc.image,
        x: loc.coordinates.x,
        y: loc.coordinates.y,
        radius: loc.radius,
      }));
      await this.db.insert(locations).values(values);
    }
  }
}

function rowToLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingHours: row.openingHours,
    image: row.image,
    coordinates: { x: row.x, y: row.y },
    radius: row.radius,
  };
}
