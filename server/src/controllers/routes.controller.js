import { Route } from '../models/route.model.js';
import { TransportInfo } from '../models/transport-info.model.js';
import { HttpError } from '../utils/http-error.js';
import { buildRoutePath } from '../services/route-builder.service.js';

export async function getRoutes(_req, res, next) {
  try {
    const routes = await Route.find({}, 'title description distanceKm durationMinutes city').sort({
      createdAt: -1,
    });
    res.json(routes);
  } catch (err) {
    next(err);
  }
}

export async function getRouteById(req, res, next) {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }
    res.json(route);
  } catch (err) {
    next(err);
  }
}

export async function buildRoute(req, res, next) {
  try {
    const mode = req.body.mode === 'masstransit' ? 'masstransit' : 'walking';
    const route = await Route.findById(req.params.id);
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }

    const built = await buildRoutePath(route, mode);
    let transportSegments = built.transportSegments || [];

    if (mode === 'masstransit' && transportSegments.length === 0) {
      const manual = await TransportInfo.find({ routeId: route._id }).sort({
        fromPointOrder: 1,
      });
      transportSegments = manual.map((item) => ({
        fromPointOrder: item.fromPointOrder,
        toPointOrder: item.toPointOrder,
        routeNumber: item.routeNumber,
        vehicleType: item.vehicleType,
        stops: item.stops.map((name, order) => ({ name, order: order + 1 })),
        source: item.source,
      }));
    }

    res.json({
      routeId: route._id,
      mode,
      source: built.source || 'fallback',
      points: [...route.points].sort((a, b) => a.order - b.order),
      coordinates: built.coordinates,
      transportSegments,
    });
  } catch (err) {
    next(err);
  }
}

