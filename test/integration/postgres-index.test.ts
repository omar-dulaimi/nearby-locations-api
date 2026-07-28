// test/integration/postgres-index.test.ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Location } from '../../src/domain/location.js';
import { PostgresLocationRepository } from '../../src/repository/postgres-location-repository.js';
import { PostgresLocationIndex } from '../../src/spatial/postgres-location-index.js';
import { createTestDb, truncateLocations } from '../helpers/postgres-test-db.js';
import type { DbHandle } from '../../src/db/connection.js';

function loc(id: string, x: number, y: number, radius: number): Location {
  return {
    id,
    name: `Loc ${id}`,
    type: 'Restaurant',
    openingHours: '9-5',
    image: 'https://x',
    coordinates: { x, y },
    radius,
  };
}

// Same worked example as the GridIndex unit test: user (3,2) sees #2 (2,2 r2) and #4 (2,3 r5).
const WORKED: Location[] = [
  loc('11111111-1111-4111-8111-111111111111', 1, 1, 1), // #1
  loc('22222222-2222-4222-8222-222222222222', 2, 2, 2), // #2 ✓
  loc('33333333-3333-4333-8333-333333333333', 5, 5, 1), // #3
  loc('44444444-4444-4444-8444-444444444444', 2, 3, 5), // #4 ✓
];

let handle: DbHandle;

async function seedWorked(): Promise<PostgresLocationIndex> {
  const repo = new PostgresLocationRepository(handle.db);
  await truncateLocations(handle.db);
  for (const l of WORKED) await repo.upsert(l);
  return new PostgresLocationIndex(handle.db);
}

beforeEach(() => {
  handle ??= createTestDb();
});

afterAll(async () => {
  await handle?.pool.end();
});

describe('PostgresLocationIndex', () => {
  it('worked example: user (3,2) → ids of #2 and #4', async () => {
    const index = await seedWorked();
    const hits = await index.search({ x: 3, y: 2 });
    const ids = hits.map((h) => h.location.id).sort();
    expect(ids).toEqual([
      '22222222-2222-4222-8222-222222222222',
      '44444444-4444-4444-8444-444444444444',
    ]);
  });

  it('boundary case: distance == radius is included', async () => {
    const repo = new PostgresLocationRepository(handle.db);
    await truncateLocations(handle.db);
    await repo.upsert(loc('11111111-1111-4111-8111-111111111112', 0, 0, 5));
    const index = new PostgresLocationIndex(handle.db);
    const hits = await index.search({ x: 3, y: 4 }); // distance = 5
    expect(hits.map((h) => h.location.id)).toEqual(['11111111-1111-4111-8111-111111111112']);
    expect(hits[0]?.distance).toBeCloseTo(5, 5);
  });

  it('empty index returns nothing', async () => {
    await truncateLocations(handle.db);
    const index = new PostgresLocationIndex(handle.db);
    expect(await index.search({ x: 1, y: 1 })).toEqual([]);
    expect(await index.size()).toBe(0);
  });

  it('bulkLoad / upsert / remove are documented no-ops (do not throw)', async () => {
    await truncateLocations(handle.db);
    const index = new PostgresLocationIndex(handle.db);
    await index.bulkLoad(WORKED);
    await index.upsert(WORKED[0]!);
    await index.remove(WORKED[0]!.id);
    // Postgres index does NOT reflect any of those operations; the data layer is the repo, not the index.
    expect(await index.size()).toBe(0);
  });

  it('needsBootstrap is false', () => {
    const index = new PostgresLocationIndex(handle.db);
    expect(index.needsBootstrap).toBe(false);
  });
});
