import { describe, it, expect } from 'vitest';
import {
  parseCoordinates,
  formatCoordinates,
  euclideanDistance,
  roundDistance,
  InvalidCoordinatesError,
} from '../../src/domain/coordinates.js';

describe('parseCoordinates', () => {
  it('parses a well-formed string', () => {
    expect(parseCoordinates('x=3,y=2')).toEqual({ x: 3, y: 2 });
    expect(parseCoordinates('x=0,y=0')).toEqual({ x: 0, y: 0 });
    expect(parseCoordinates('x=1234567,y=987654')).toEqual({ x: 1234567, y: 987654 });
  });
  it('rejects malformed / negative / non-integer strings', () => {
    for (const bad of ['', 'x=1', 'y=1,x=1', 'x=-1,y=2', 'x=1.5,y=2', 'x= 1,y=2', 'foo', 'x=a,y=b', 'x=1,y=2 ']) {
      expect(() => parseCoordinates(bad)).toThrow(InvalidCoordinatesError);
    }
  });
});

describe('formatCoordinates', () => {
  it('formats and round-trips', () => {
    expect(formatCoordinates({ x: 3, y: 2 })).toBe('x=3,y=2');
    expect(parseCoordinates(formatCoordinates({ x: 42, y: 7 }))).toEqual({ x: 42, y: 7 });
  });
});

describe('euclideanDistance', () => {
  it('computes the straight-line distance', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(euclideanDistance({ x: 3, y: 2 }, { x: 2, y: 3 })).toBeCloseTo(Math.SQRT2, 12);
    expect(euclideanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('roundDistance', () => {
  it('rounds to 5 decimal places', () => {
    expect(roundDistance(Math.SQRT2)).toBe(1.41421);
    expect(roundDistance(1)).toBe(1);
    expect(roundDistance(2.000004)).toBe(2);
    expect(roundDistance(2.000006)).toBe(2.00001);
  });
});
