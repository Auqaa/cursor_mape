import { Route } from '../models/route.model.js';
import { buildWalkingRoute, chooseScenicWaypoints } from '../services/dgis.service.js';
import { HttpError } from '../utils/http-error.js';

function normalizePointPayload(point, label) {
  if (!point) {
    throw new HttpError(400, `${label} is required`);
  }

  const lat = Number(point.lat ?? point.coordinates?.lat);
  const lon = Number(point.lon ?? point.coordinates?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpError(400, `${label} must include valid lat/lon`);
  }

  return {
    title: point.title || point.name || '',
    lat,
    lon,
  };
}

function normalizeWaypoints(waypoints = []) {
  return (Array.isArray(waypoints) ? waypoints : []).map((point, index) =>
    normalizePointPayload(point, `waypoint ${index + 1}`)
  );
}

function dedupeWaypoints(waypoints = []) {
  const seen = new Set();
  return waypoints.filter((point) => {
    const key = `${point.lon.toFixed(6)}:${point.lat.toFixed(6)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function getRouteWaypoints(routeId, targetPointOrder) {
  if (!routeId) {
    return [];
  }

  const route = await Route.findById(routeId);
  if (!route) {
    throw new HttpError(404, 'Route not found');
  }

  const sortedPoints = (route.points || [])
    .filter((point) => point?.coordinates && typeof point.order === 'number')
    .slice()
    .sort((a, b) => a.order - b.order);

  if (!targetPointOrder) {
    return sortedPoints
      .filter((point) => point.pointType === 'waypoint')
      .map((point) => ({
        title: point.title,
        lat: point.coordinates.lat,
        lon: point.coordinates.lon,
      }));
  }

  return sortedPoints
    .filter((point) => point.pointType === 'waypoint' && point.order < targetPointOrder)
    .map((point) => ({
      title: point.title,
      lat: point.coordinates.lat,
      lon: point.coordinates.lon,
    }));
}

export async function buildNavigationRoute(req, res, next) {
  try {
    const mode = ['thematic', 'free', 'direct'].includes(req.body.mode) ? req.body.mode : 'direct';
    const origin = normalizePointPayload(req.body.origin, 'origin');
    const destination = normalizePointPayload(req.body.destination, 'destination');
    const targetPointOrder = Number(req.body.targetPointOrder) || null;

    const explicitWaypoints = normalizeWaypoints(req.body.waypoints);
    const curatedWaypoints =
      explicitWaypoints.length > 0 ? explicitWaypoints : await getRouteWaypoints(req.body.routeId, targetPointOrder);

    let scenicWaypoints = [];
    if (!curatedWaypoints.length && mode !== 'direct' && req.body.includeScenic !== false) {
      scenicWaypoints = await chooseScenicWaypoints({
        origin,
        destination,
        limit: Math.min(Number(req.body.maxScenicWaypoints) || 3, 5),
      });
    }

    const routeWaypoints = dedupeWaypoints(
      [...curatedWaypoints, ...scenicWaypoints].map((point) => ({
        title: point.title,
        lat: point.lat ?? point.coordinates?.lat,
        lon: point.lon ?? point.coordinates?.lon,
        source: point.source || 'curated',
        pointType: point.pointType || 'waypoint',
      }))
    );

    const builtRoute = await buildWalkingRoute({
      origin,
      destination,
      waypoints: routeWaypoints,
    });

    res.json({
      mode,
      source: builtRoute.source,
      origin,
      destination,
      geometry: builtRoute.geometry,
      summary: builtRoute.summary,
      maneuvers: builtRoute.maneuvers,
      scenicWaypointsUsed: scenicWaypoints,
      waypoints: routeWaypoints,
    });
  } catch (err) {
    next(err);
  }
}
