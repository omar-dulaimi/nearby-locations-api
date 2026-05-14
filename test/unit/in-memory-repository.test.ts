import { describe, it, expect } from 'vitest';
import { InMemoryLocationRepository } from '../../src/repository/in-memory-location-repository.js';
import type { Location } from '../../src/domain/location.js';

function loc(id: string, x = 1, y = 1, radius = 1): Location {
  return {
    id,
    name: id,
    type: 'Restaurant',
    openingHours: 'h',
    image: 'https://x',
    coordinates: { x, y },
    radius,
  };
}

describe('InMemoryLocationRepository', () => {
  it('starts with the initial locations', async () => {
    const repo = new InMemoryLocationRepository([loc('a'), loc('b')]);
    expect(await repo.count()).toBe(2);
    expect((await repo.getById('a'))?.id).toBe('a');
    expect(await repo.getById('zzz')).toBeUndefined();
    expect((await repo.all()).map((l) => l.id).sort()).toEqual(['a', 'b']);
  });
  it('upsert inserts then replaces', async () => {
    const repo = new InMemoryLocationRepository([]);
    await repo.upsert(loc('a', 1, 1, 1));
    expect(await repo.count()).toBe(1);
    await repo.upsert(loc('a', 2, 2, 9));
    expect(await repo.count()).toBe(1);
    expect(await repo.getById('a')).toMatchObject({ coordinates: { x: 2, y: 2 }, radius: 9 });
  });
  it('all() returns a snapshot (mutating it does not affect the repo)', async () => {
    const repo = new InMemoryLocationRepository([loc('a')]);
    (await repo.all()).push(loc('b'));
    expect(await repo.count()).toBe(1);
  });
});
