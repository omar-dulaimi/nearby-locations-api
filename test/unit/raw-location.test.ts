import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { RawLocationSchema, rawToLocation, type RawLocation } from '../../src/schemas/raw-location.js';

const good: RawLocation = {
  name: 'Da Jia Le',
  type: 'Restaurant',
  id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
  'opening-hours': '10:00AM-11:00PM',
  image: 'https://tinyurl.com',
  coordinates: 'x=5,y=5',
  radius: 8,
};

describe('RawLocationSchema', () => {
  it('accepts a well-formed record', () => {
    expect(Value.Check(RawLocationSchema, good)).toBe(true);
  });
  it('rejects bad records', () => {
    expect(Value.Check(RawLocationSchema, { ...good, id: 'not-a-uuid' })).toBe(false);
    expect(Value.Check(RawLocationSchema, { ...good, radius: 0 })).toBe(false);
    expect(Value.Check(RawLocationSchema, { ...good, radius: 1.5 })).toBe(false);
    expect(Value.Check(RawLocationSchema, { ...good, coordinates: 'x=1' })).toBe(false);
    expect(Value.Check(RawLocationSchema, { ...good, name: '' })).toBe(false);
    expect(Value.Check(RawLocationSchema, { ...good, image: 'not a url' })).toBe(false);
    const { coordinates: _omit, ...missing } = good;
    expect(Value.Check(RawLocationSchema, missing)).toBe(false);
  });
});

describe('rawToLocation', () => {
  it('converts to the internal Location shape', () => {
    expect(rawToLocation(good)).toEqual({
      id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
      name: 'Da Jia Le',
      type: 'Restaurant',
      openingHours: '10:00AM-11:00PM',
      image: 'https://tinyurl.com',
      coordinates: { x: 5, y: 5 },
      radius: 8,
    });
  });
});
