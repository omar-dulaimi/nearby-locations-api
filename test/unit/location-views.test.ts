import { describe, it, expect } from 'vitest';
import { toSearchView, toDetailView, type Location } from '../../src/domain/location.js';

const loc: Location = {
  id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
  name: 'Da Jia Le',
  type: 'Restaurant',
  openingHours: '10:00AM-11:00PM',
  image: 'https://tinyurl.com',
  coordinates: { x: 5, y: 5 },
  radius: 8,
};

describe('toSearchView', () => {
  it('produces the minimal search view with the formatted coordinates and distance', () => {
    expect(toSearchView(loc, 1.41421)).toEqual({
      id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
      name: 'Da Jia Le',
      coordinates: 'x=5,y=5',
      distance: 1.41421,
    });
  });
});

describe('toDetailView', () => {
  it('produces the detail view (kebab-case opening-hours, includes radius)', () => {
    expect(toDetailView(loc)).toEqual({
      name: 'Da Jia Le',
      type: 'Restaurant',
      id: '51e1545c-8b65-4d83-82f9-7fcad4a23111',
      'opening-hours': '10:00AM-11:00PM',
      image: 'https://tinyurl.com',
      coordinates: 'x=5,y=5',
      radius: 8,
    });
  });
});
