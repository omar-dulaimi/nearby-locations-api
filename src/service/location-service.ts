import type { Coordinates } from '../domain/coordinates.js';
import type { Location } from '../domain/location.js';
import type { LocationRepository } from '../repository/location-repository.js';
import type { IndexHit, LocationIndex } from '../spatial/location-index.js';
import type { SearchCache } from '../cache/search-cache.js';

export class LocationService {
  private version = 1;

  constructor(
    private readonly repo: LocationRepository,
    private readonly index: LocationIndex,
    private readonly cache?: SearchCache<IndexHit[]>,
  ) {}

  /** Populate the index from the repository. Call once after construction. */
  bootstrap(): void {
    this.index.bulkLoad(this.repo.all());
  }

  search(point: Coordinates): IndexHit[] {
    const key = `${this.version}:${point.x}:${point.y}`;
    const cached = this.cache?.get(key);
    if (cached) return cached;
    const hits = [...this.index.search(point)].sort(
      (a, b) => a.distance - b.distance || (a.location.id < b.location.id ? -1 : a.location.id > b.location.id ? 1 : 0),
    );
    this.cache?.set(key, hits);
    return hits;
  }

  getById(id: string): Location | undefined {
    return this.repo.getById(id);
  }

  upsert(location: Location): { created: boolean } {
    const created = this.repo.getById(location.id) === undefined;
    this.repo.upsert(location);
    this.index.upsert(location);
    this.version++;
    return { created };
  }

  dataVersion(): number {
    return this.version;
  }

  count(): number {
    return this.repo.count();
  }
}
