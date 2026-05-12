import { describe, it, expect } from 'vitest';
import { SearchCache } from '../../src/cache/search-cache.js';

describe('SearchCache', () => {
  it('stores and retrieves by key', () => {
    const c = new SearchCache<number>(2);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.get('missing')).toBeUndefined();
  });
  it('evicts least-recently-used when over capacity', () => {
    const c = new SearchCache<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
  });
  it('capacity 0 is a no-op cache', () => {
    const c = new SearchCache<number>(0);
    c.set('a', 1);
    expect(c.get('a')).toBeUndefined();
  });
});
