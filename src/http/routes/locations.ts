import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  formatCoordinates,
  InvalidCoordinatesError,
  roundDistance,
} from '../../domain/coordinates.js';
import type { Location } from '../../domain/location.js';
import { toDetailView, toSearchView } from '../../domain/location.js';
import { rawToLocation } from '../../schemas/raw-location.js';
import type { LocationService } from '../../service/location-service.js';
import { badRequest, notFound } from '../problems.js';
import { ProblemSchema } from '../schemas/common.js';
import {
  DetailResponseSchema,
  LocationParamsSchema,
  SearchQuerySchema,
  SearchResponseSchema,
  UpsertBodySchema,
} from '../schemas/location-http-schemas.js';

const bearerSecurity = [{ bearerAuth: [] }];

export interface LocationsRoutesOptions {
  service: LocationService;
}

export const locationsRoutes: FastifyPluginAsyncTypebox<LocationsRoutesOptions> = async (
  app,
  opts,
) => {
  const { service } = opts;

  app.get(
    '/locations/search',
    {
      onRequest: [app.authenticate],
      config: { rateLimitTier: 'read', cacheControl: 'private, no-cache' },
      schema: {
        tags: ['locations'],
        summary: 'Find locations whose service radius reaches the given point',
        security: bearerSecurity,
        querystring: SearchQuerySchema,
        response: {
          200: SearchResponseSchema,
          400: ProblemSchema,
          401: ProblemSchema,
          429: ProblemSchema,
        },
      },
    },
    async (req) => {
      const { x, y } = req.query;
      const hits = service.search({ x, y });
      return {
        'user-location': formatCoordinates({ x, y }),
        locations: hits.map((h) => toSearchView(h.location, roundDistance(h.distance))),
      };
    },
  );

  app.get(
    '/locations/:id',
    {
      onRequest: [app.authenticate],
      config: { rateLimitTier: 'read', cacheControl: 'private, no-cache' },
      schema: {
        tags: ['locations'],
        summary: 'Get a location by id',
        security: bearerSecurity,
        params: LocationParamsSchema,
        response: {
          200: DetailResponseSchema,
          400: ProblemSchema,
          401: ProblemSchema,
          404: ProblemSchema,
          429: ProblemSchema,
        },
      },
    },
    async (req) => {
      const loc = service.getById(req.params.id);
      if (!loc) throw notFound(`No location with id ${req.params.id}`, { instance: req.url });
      return toDetailView(loc);
    },
  );

  app.put(
    '/locations/:id',
    {
      onRequest: [app.authenticate, app.requireRole('writer')],
      config: { rateLimitTier: 'write' },
      schema: {
        tags: ['locations'],
        summary: 'Create or replace a location',
        security: bearerSecurity,
        params: LocationParamsSchema,
        body: UpsertBodySchema,
        response: {
          200: DetailResponseSchema,
          201: DetailResponseSchema,
          400: ProblemSchema,
          401: ProblemSchema,
          403: ProblemSchema,
          429: ProblemSchema,
        },
      },
    },
    async (req, reply) => {
      if (req.body.id !== req.params.id) {
        throw badRequest('The "id" in the body must match the id in the URL', {
          instance: req.url,
        });
      }
      let location: Location;
      try {
        location = rawToLocation(req.body);
      } catch (err) {
        if (err instanceof InvalidCoordinatesError) {
          throw badRequest(err.message, { instance: req.url });
        }
        throw err;
      }
      const { created } = service.upsert(location);
      reply.code(created ? 201 : 200);
      if (created) reply.header('Location', `/locations/${location.id}`);
      return toDetailView(location);
    },
  );
};
