import { describe, it, expect } from 'vitest';
import { LocationService } from '../../src/service/location-service.js';
import { InMemoryLocationRepository } from '../../src/repository/in-memory-location-repository.js';
import { GridIndex } from '../../src/spatial/grid-index.js';
import { SearchCache } from '../../src/cache/search-cache.js';
import type { IndexHit } from '../../src/spatial/location-index.js';
import type { Location } from '../../src/domain/location.js';

function loc(id: string, x: number, y: number, radius: number, name = id): Location {
  return {
    id,
    name,
    type: 'Restaurant',
    openingHours: 'h',
    image: 'https://x',
    coordinates: { x, y },
    radius,
  };
}

function makeService(initial: Location[], cacheSize = 0) {
  const repo = new InMemoryLocationRepository(initial);
  const index = new GridIndex();
  const cache = cacheSize > 0 ? new SearchCache<IndexHit[]>(cacheSize) : undefined;
  const svc = new LocationService(repo, index, cache);
  svc.bootstrap();
  return { svc, repo, index };
}

describe('LocationService', () => {
  it('search returns hits sorted by distance ascending, ties broken by id', () => {
    const { svc } = makeService([
      loc('b', 2, 2, 5),
      loc('a', 2, 2, 5),
      loc('c', 0, 0, 5),
      loc('z', 100, 100, 1),
    ]);
    const hits = svc.search({ x: 3, y: 2 });
    expect(hits.map((h) => h.location.id)).toEqual(['a', 'b', 'c']);
    expect(hits[0]!.distance).toBe(1);
  });

  it('getById returns the location or undefined', () => {
    const { svc } = makeService([loc('a', 1, 1, 1)]);
    expect(svc.getById('a')?.id).toBe('a');
    expect(svc.getById('nope')).toBeUndefined();
  });

  it('count reflects the repository', () => {
    const { svc } = makeService([loc('a', 1, 1, 1), loc('b', 2, 2, 1)]);
    expect(svc.count()).toBe(2);
  });

  it('upsert creates (created: true) and updates (created: false), reindexing each time and bumping the data version', () => {
    const { svc } = makeService([loc('a', 2, 2, 2)]);
    const v0 = svc.dataVersion();
    expect(svc.search({ x: 3, y: 2 }).map((h) => h.location.id)).toEqual(['a']);

    const r1 = svc.upsert(loc('b', 2, 3, 5, 'B'));
    expect(r1).toEqual({ created: true });
    expect(svc.dataVersion()).toBeGreaterThan(v0);
    expect(
      svc
        .search({ x: 3, y: 2 })
        .map((h) => h.location.id)
        .sort(),
    ).toEqual(['a', 'b']);

    const r2 = svc.upsert(loc('a', 1000, 1000, 2, 'A moved'));
    expect(r2).toEqual({ created: false });
    expect(svc.search({ x: 3, y: 2 }).map((h) => h.location.id)).toEqual(['b']);
    expect(svc.getById('a')).toMatchObject({ name: 'A moved', coordinates: { x: 1000, y: 1000 } });
    expect(svc.count()).toBe(2);
  });

  it('uses the search cache and invalidates it on upsert (via the data version key)', () => {
    const { svc, index } = makeService([loc('a', 2, 2, 2)], 16);
    const first = svc.search({ x: 3, y: 2 });
    index.bulkLoad([]); // mutate the index out-of-band to prove the next identical query comes from cache
    const cached = svc.search({ x: 3, y: 2 });
    expect(cached.map((h) => h.location.id)).toEqual(first.map((h) => h.location.id));
    svc.upsert(loc('a', 2, 2, 2)); // bumps the version -> key changes -> index consulted (and upsert reloaded the index entry too)
    expect(svc.search({ x: 3, y: 2 }).map((h) => h.location.id)).toEqual(['a']);
  });
});
