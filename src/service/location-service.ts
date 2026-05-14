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

  /** Populate the index from the repository, if the index needs warm-up. Idempotent. */
  async bootstrap(): Promise<void> {
    if (this.index.needsBootstrap) {
      await this.index.bulkLoad(await this.repo.all());
    }
  }

  async search(point: Coordinates): Promise<IndexHit[]> {
    const key = `${this.version}:${point.x}:${point.y}`;
    const cached = this.cache?.get(key);
    if (cached) return cached;
    const raw = await this.index.search(point);
    const hits = [...raw].sort(
      (a, b) =>
        a.distance - b.distance ||
        (a.location.id < b.location.id ? -1 : a.location.id > b.location.id ? 1 : 0),
    );
    this.cache?.set(key, hits);
    return hits;
  }

  async getById(id: string): Promise<Location | undefined> {
    return this.repo.getById(id);
  }

  async upsert(location: Location): Promise<{ created: boolean }> {
    const created = (await this.repo.getById(location.id)) === undefined;
    await this.repo.upsert(location);
    await this.index.upsert(location);
    this.version++;
    return { created };
  }

  dataVersion(): number {
    return this.version;
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}
