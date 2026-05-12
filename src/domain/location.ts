import { formatCoordinates, type Coordinates } from './coordinates.js';

export interface Location {
  id: string; // UUID
  name: string;
  type: string;
  openingHours: string;
  image: string;
  coordinates: Coordinates;
  radius: number; // positive integer
}

export interface SearchView {
  id: string;
  name: string;
  coordinates: string;
  distance: number;
}

export interface DetailView {
  name: string;
  type: string;
  id: string;
  'opening-hours': string;
  image: string;
  coordinates: string;
  radius: number;
}

export function toSearchView(loc: Location, distance: number): SearchView {
  return { id: loc.id, name: loc.name, coordinates: formatCoordinates(loc.coordinates), distance };
}

export function toDetailView(loc: Location): DetailView {
  return {
    name: loc.name,
    type: loc.type,
    id: loc.id,
    'opening-hours': loc.openingHours,
    image: loc.image,
    coordinates: formatCoordinates(loc.coordinates),
    radius: loc.radius,
  };
}
