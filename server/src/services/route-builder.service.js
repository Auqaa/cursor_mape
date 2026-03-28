import { buildWalkingRoute } from './dgis.service.js';

const WALKING_WAYPOINT_LIMIT = 10;

function buildFallbackCoordinates(sortedPoints) {
  return sortedPoints.map((point) => [point.coordinates.lat, point.coordinates.lon]);
}

function buildFallbackSummary(route) {
  return {
    distanceMeters: Math.round((route.distanceKm || 0) * 1000),
    durationSeconds: Math.round((route.durationMinutes || 0) * 60),
  };
}

export async function buildRoutePath(route) {
  const sortedPoints = (route.points || [])
    .filter((point) => point && point.coordinates && typeof point.order === 'number')
    .sort((a, b) => a.order - b.order);
  const fallbackCoordinates = buildFallbackCoordinates(sortedPoints);
  const fallbackSummary = buildFallbackSummary(route);

  if (sortedPoints.length < 2) {
    return {
      coordinates: fallbackCoordinates,
      summary: fallbackSummary,
      source: 'fallback',
    };
  }

  if (sortedPoints.length > WALKING_WAYPOINT_LIMIT) {
    throw new Error(`Walking mode supports up to ${WALKING_WAYPOINT_LIMIT} points`);
  }

  const origin = sortedPoints[0].coordinates;
  const destination = sortedPoints[sortedPoints.length - 1].coordinates;
  const waypoints = sortedPoints.slice(1, -1).map((point) => point.coordinates);
  const builtRoute = await buildWalkingRoute({
    origin,
    destination,
    waypoints,
  });

  return {
    coordinates:
      builtRoute.geometry?.length > 1
        ? builtRoute.geometry.map(([lon, lat]) => [lat, lon])
        : fallbackCoordinates,
    summary: {
      ...fallbackSummary,
      ...(builtRoute.summary || {}),
    },
    source: builtRoute.source || 'fallback',
  };
}
