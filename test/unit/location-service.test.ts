import { describe, it, expect } from 'vitest';
import { LocationService } from '../../src/service/location-service.js';
import { InMemoryLocationRepository } from '../../src/repository/in-memory-location-repository.js';
import { GridIndex } from '../../src/spatial/grid-index.js';
import { SearchCache } from '../../src/cache/search-cache.js';
import type { IndexHit } from '../../src/spatial/location-index.js';
import type { Location } from '../../src/domain/location.js';

function loc(id: string, x: number, y: number, radius: number, name = id): Location {
  return { id, name, type: 'Restaurant', openingHours: 'h', image: 'https://x', coordinates: { x, y }, radius };
}

async function makeService(initial: Location[], cacheSize = 0) {
  const repo = new InMemoryLocationRepository(initial);
  const index = new GridIndex();
  const cache = cacheSize > 0 ? new SearchCache<IndexHit[]>(cacheSize) : undefined;
  const svc = new LocationService(repo, index, cache);
  await svc.bootstrap();
  return { svc, repo, index };
}

describe('LocationService', () => {
  it('search returns hits sorted by distance ascending, ties broken by id', async () => {
    const { svc } = await makeService([
      loc('b', 2, 2, 5),
      loc('a', 2, 2, 5),
      loc('c', 0, 0, 5),
      loc('z', 100, 100, 1),
    ]);
    const hits = await svc.search({ x: 3, y: 2 });
    expect(hits.map((h) => h.location.id)).toEqual(['a', 'b', 'c']);
    expect(hits[0]!.distance).toBe(1);
  });

  it('getById returns the location or undefined', async () => {
    const { svc } = await makeService([loc('a', 1, 1, 1)]);
    expect((await svc.getById('a'))?.id).toBe('a');
    expect(await svc.getById('nope')).toBeUndefined();
  });

  it('count reflects the repository', async () => {
    const { svc } = await makeService([loc('a', 1, 1, 1), loc('b', 2, 2, 1)]);
    expect(await svc.count()).toBe(2);
  });

  it('upsert creates (created: true) and updates (created: false), reindexing each time and bumping the data version', async () => {
    const { svc } = await makeService([loc('a', 2, 2, 2)]);
    const v0 = svc.dataVersion();
    expect((await svc.search({ x: 3, y: 2 })).map((h) => h.location.id)).toEqual(['a']);

    const r1 = await svc.upsert(loc('b', 2, 3, 5, 'B'));
    expect(r1).toEqual({ created: true });
    expect(svc.dataVersion()).toBeGreaterThan(v0);
    expect((await svc.search({ x: 3, y: 2 })).map((h) => h.location.id).sort()).toEqual(['a', 'b']);

    const r2 = await svc.upsert(loc('a', 1000, 1000, 2, 'A moved'));
    expect(r2).toEqual({ created: false });
    expect((await svc.search({ x: 3, y: 2 })).map((h) => h.location.id)).toEqual(['b']);
    expect(await svc.getById('a')).toMatchObject({ name: 'A moved', coordinates: { x: 1000, y: 1000 } });
    expect(await svc.count()).toBe(2);
  });

  it('uses the search cache and invalidates it on upsert (via the data version key)', async () => {
    const { svc, index } = await makeService([loc('a', 2, 2, 2)], 16);
    const first = await svc.search({ x: 3, y: 2 });
    index.bulkLoad([]); // mutate the index out-of-band to prove the next identical query comes from cache
    const cached = await svc.search({ x: 3, y: 2 });
    expect(cached.map((h) => h.location.id)).toEqual(first.map((h) => h.location.id));
    await svc.upsert(loc('a', 2, 2, 2));
    expect((await svc.search({ x: 3, y: 2 })).map((h) => h.location.id)).toEqual(['a']);
  });
});
