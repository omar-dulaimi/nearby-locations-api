import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Location } from '../../src/domain/location.js';
import { InMemoryLocationRepository } from '../../src/repository/in-memory-location-repository.js';
import { PostgresLocationRepository } from '../../src/repository/postgres-location-repository.js';
import type { LocationRepository } from '../../src/repository/location-repository.js';
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

const SEED: Location[] = [
  loc('11111111-1111-4111-8111-111111111111', 1, 1, 1),
  loc('22222222-2222-4222-8222-222222222222', 2, 2, 2),
];

interface BackendCase {
  name: string;
  build: () => Promise<{ repo: LocationRepository; teardown?: () => Promise<void> }>;
}

const inMemoryCase: BackendCase = {
  name: 'in-memory',
  build: async () => ({ repo: new InMemoryLocationRepository(SEED) }),
};

let sharedDb: DbHandle | undefined;
const postgresCase: BackendCase = {
  name: 'postgres',
  build: async () => {
    sharedDb ??= createTestDb();
    await truncateLocations(sharedDb.db);
    const repo = new PostgresLocationRepository(sharedDb.db);
    for (const l of SEED) await repo.upsert(l);
    return { repo };
  },
};

afterAll(async () => {
  await sharedDb?.pool.end();
});

describe.each([inMemoryCase, postgresCase])('LocationRepository contract: $name', ({ build }) => {
  let repo: LocationRepository;
  beforeEach(async () => {
    repo = (await build()).repo;
  });

  it('count() reflects the seeded data', async () => {
    expect(await repo.count()).toBe(2);
  });

  it('getById returns a seeded record', async () => {
    const found = await repo.getById('11111111-1111-4111-8111-111111111111');
    expect(found).toMatchObject({ coordinates: { x: 1, y: 1 }, radius: 1 });
  });

  it('getById returns undefined for an unknown id', async () => {
    expect(await repo.getById('00000000-0000-4000-8000-000000000000')).toBeUndefined();
  });

  it('upsert inserts a new row', async () => {
    await repo.upsert(loc('33333333-3333-4333-8333-333333333333', 9, 9, 9));
    expect(await repo.count()).toBe(3);
    expect((await repo.getById('33333333-3333-4333-8333-333333333333'))?.radius).toBe(9);
  });

  it('upsert replaces an existing row', async () => {
    await repo.upsert(loc('11111111-1111-4111-8111-111111111111', 50, 60, 70));
    expect(await repo.count()).toBe(2); // no new row
    const found = await repo.getById('11111111-1111-4111-8111-111111111111');
    expect(found).toMatchObject({ coordinates: { x: 50, y: 60 }, radius: 70 });
  });

  it('all() returns a snapshot containing every seeded record', async () => {
    const ids = (await repo.all()).map((l) => l.id).sort();
    expect(ids).toEqual(SEED.map((l) => l.id).sort());
  });
});
