import type { Location } from '../domain/location.js';

export interface LocationRepository {
  getById(id: string): Location | undefined;
  /** Insert or replace by id. */
  upsert(location: Location): void;
  /** A snapshot of all locations (order not significant). */
  all(): Location[];
  count(): number;
}
