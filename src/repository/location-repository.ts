import type { Location } from '../domain/location.js';

export interface LocationRepository {
  getById(id: string): Promise<Location | undefined>;
  /** Insert or replace by id. */
  upsert(location: Location): Promise<void>;
  /** A snapshot of all locations (order not significant). */
  all(): Promise<Location[]>;
  count(): Promise<number>;
}
