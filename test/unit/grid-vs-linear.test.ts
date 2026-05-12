import { describe, it, expect } from 'vitest';
import { GridIndex } from '../../src/spatial/grid-index.js';
import { LinearScanIndex } from '../../src/spatial/linear-scan-index.js';
import type { Location } from '../../src/domain/location.js';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLocations(
  r: () => number,
  n: number,
  maxCoord: number,
  maxRadius: number,
): Location[] {
  const out: Location[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `loc-${i}`,
      name: `loc-${i}`,
      type: 'Restaurant',
      openingHours: '10:00AM-11:00PM',
      image: 'https://x',
      coordinates: { x: Math.floor(r() * maxCoord), y: Math.floor(r() * maxCoord) },
      radius: 1 + Math.floor(r() * maxRadius),
    });
  }
  return out;
}

describe('GridIndex === LinearScanIndex on random data', () => {
  it('returns identical result sets for random queries (bulkLoad)', () => {
    const r = rng(12345);
    const locations = makeLocations(r, 800, 500, 25);
    const grid = new GridIndex();
    const lin = new LinearScanIndex();
    grid.bulkLoad(locations);
    lin.bulkLoad(locations);
    for (let q = 0; q < 400; q++) {
      const point = { x: Math.floor(r() * 500), y: Math.floor(r() * 500) };
      const a = grid
        .search(point)
        .map((h) => h.location.id)
        .sort();
      const b = lin
        .search(point)
        .map((h) => h.location.id)
        .sort();
      expect(a, `query #${q} ${JSON.stringify(point)}`).toEqual(b);
    }
  });

  it('stays consistent after a mix of upserts and removes (including a radius-growth rebuild)', () => {
    const r = rng(999);
    const initial = makeLocations(r, 200, 300, 10);
    const grid = new GridIndex();
    const lin = new LinearScanIndex();
    grid.bulkLoad(initial);
    lin.bulkLoad(initial);
    for (let i = 0; i < 300; i++) {
      const op = r();
      if (op < 0.55) {
        const big = r() < 0.05;
        const l: Location = {
          id: `loc-${Math.floor(r() * 250)}`,
          name: 'x',
          type: 'Restaurant',
          openingHours: 'h',
          image: 'https://x',
          coordinates: { x: Math.floor(r() * 300), y: Math.floor(r() * 300) },
          radius: big ? 50 + Math.floor(r() * 100) : 1 + Math.floor(r() * 10),
        };
        grid.upsert(l);
        lin.upsert(l);
      } else if (op < 0.8) {
        const id = `loc-${Math.floor(r() * 250)}`;
        grid.remove(id);
        lin.remove(id);
      } else {
        const point = { x: Math.floor(r() * 300), y: Math.floor(r() * 300) };
        const a = grid
          .search(point)
          .map((h) => h.location.id)
          .sort();
        const b = lin
          .search(point)
          .map((h) => h.location.id)
          .sort();
        expect(a, `op #${i} query ${JSON.stringify(point)}`).toEqual(b);
      }
    }
    expect(grid.size()).toBe(lin.size());
  });
});
