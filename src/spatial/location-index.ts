import type { Location } from '../domain/location.js';
import type { Coordinates } from '../domain/coordinates.js';

export interface IndexHit {
  location: Location;
  distance: number; // exact (unrounded) Euclidean distance to the query point
}

export interface LocationIndex {
  /** Replace the index contents with these locations. */
  bulkLoad(locations: Location[]): void;
  /** Add or replace a single location (replace = same id already present). */
  upsert(location: Location): void;
  /** Remove a location by id. No-op if absent. */
  remove(id: string): void;
  /** All locations whose disk contains the query point, with their exact distances (unsorted). */
  search(point: Coordinates): IndexHit[];
  /** Number of indexed locations. */
  size(): number;
}
