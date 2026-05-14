import type { Location } from '../domain/location.js';
import type { Coordinates } from '../domain/coordinates.js';

export interface IndexHit {
  location: Location;
  distance: number;
}

export interface LocationIndex {
  /** Whether `LocationService.bootstrap()` should warm this index from the repository's `all()`. */
  readonly needsBootstrap: boolean;
  /** Replace the index contents with these locations. */
  bulkLoad(locations: Location[]): void | Promise<void>;
  /** Add or replace a single location (replace = same id already present). */
  upsert(location: Location): void | Promise<void>;
  /** Remove a location by id. No-op if absent. */
  remove(id: string): void | Promise<void>;
  /** All locations whose disk contains the query point, with their exact distances (unsorted). */
  search(point: Coordinates): IndexHit[] | Promise<IndexHit[]>;
  /** Number of indexed locations. */
  size(): number | Promise<number>;
}
