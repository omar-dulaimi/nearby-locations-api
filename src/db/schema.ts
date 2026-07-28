import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  openingHours: text('opening_hours').notNull(),
  image: text('image').notNull(),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  radius: integer('radius').notNull(),
  // `geom` is DB-maintained (GENERATED ALWAYS AS) and intentionally not in this schema.
  // PostGIS queries use Drizzle's `sql` template tag against it directly.
});

export type LocationRow = typeof locations.$inferSelect;
