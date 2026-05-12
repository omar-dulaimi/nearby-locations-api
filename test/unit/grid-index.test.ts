import { describe, it, expect } from 'vitest';
import { GridIndex } from '../../src/spatial/grid-index.js';
import type { Location } from '../../src/domain/location.js';

function loc(id: string, x: number, y: number, radius: number): Location {
  return {
    id,
    name: id,
    type: 'Restaurant',
    openingHours: '10:00AM-11:00PM',
    image: 'https://x',
    coordinates: { x, y },
    radius,
  };
}

const worked: Location[] = [
  loc('#1', 1, 1, 1),
  loc('#2', 2, 2, 2),
  loc('#3', 5, 5, 1),
  loc('#4', 2, 3, 5),
];

describe('GridIndex', () => {
  it('worked example: user (3,2) -> #2 and #4', () => {
    const idx = new GridIndex();
    idx.bulkLoad(worked);
    expect(
      idx
        .search({ x: 3, y: 2 })
        .map((h) => h.location.id)
        .sort(),
    ).toEqual(['#2', '#4']);
  });

  it('empty index returns nothing', () => {
    const idx = new GridIndex();
    idx.bulkLoad([]);
    expect(idx.search({ x: 1, y: 1 })).toEqual([]);
    expect(idx.size()).toBe(0);
  });

  it('boundary case distance == radius is included', () => {
    const idx = new GridIndex();
    idx.bulkLoad([loc('a', 0, 0, 5)]);
    expect(idx.search({ x: 3, y: 4 }).map((h) => h.location.id)).toEqual(['a']);
  });

  it('handles large sparse coordinates (cell map stays small)', () => {
    const idx = new GridIndex();
    idx.bulkLoad([loc('far', 1_000_000, 2_000_000, 3), loc('near', 1_000_001, 2_000_001, 3)]);
    expect(
      idx
        .search({ x: 1_000_000, y: 2_000_000 })
        .map((h) => h.location.id)
        .sort(),
    ).toEqual(['far', 'near']);
    expect(idx.search({ x: 0, y: 0 })).toEqual([]);
  });

  it('upsert that moves a location reindexes it', () => {
    const idx = new GridIndex();
    idx.bulkLoad([loc('a', 2, 2, 2)]);
    expect(idx.search({ x: 3, y: 2 }).map((h) => h.location.id)).toEqual(['a']);
    idx.upsert(loc('a', 1000, 1000, 2));
    expect(idx.search({ x: 3, y: 2 })).toEqual([]);
    expect(idx.search({ x: 1000, y: 1000 }).map((h) => h.location.id)).toEqual(['a']);
    expect(idx.size()).toBe(1);
  });

  it('remove drops the location', () => {
    const idx = new GridIndex();
    idx.bulkLoad([loc('a', 2, 2, 2), loc('b', 2, 3, 5)]);
    idx.remove('a');
    expect(idx.search({ x: 3, y: 2 }).map((h) => h.location.id)).toEqual(['b']);
    idx.remove('missing');
    expect(idx.size()).toBe(1);
  });

  it('inserting a radius bigger than the current cell size triggers a rebuild and stays correct', () => {
    const idx = new GridIndex();
    idx.bulkLoad([loc('small', 0, 0, 1), loc('mid', 50, 50, 2)]);
    expect(idx.search({ x: 30, y: 30 })).toEqual([]);
    idx.upsert(loc('huge', 40, 40, 100));
    expect(idx.search({ x: 30, y: 30 }).map((h) => h.location.id)).toEqual(['huge']);
    expect(
      idx
        .search({ x: 0, y: 0 })
        .map((h) => h.location.id)
        .sort(),
    ).toEqual(['huge', 'small']);
    expect(idx.size()).toBe(3);
  });
});
