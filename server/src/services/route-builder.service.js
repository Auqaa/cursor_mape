import axios from 'axios';

function toPoint(point) {
  return `${point.coordinates.lon},${point.coordinates.lat}`;
}

function buildFallback(route, mode) {
  if (mode !== 'masstransit') {
    return [];
  }

  return route.fallbackTransportSegments.map((segment) => ({
    fromPointOrder: segment.fromPointOrder,
    toPointOrder: segment.toPointOrder,
    routeNumber: segment.routeNumber,
    vehicleType: segment.vehicleType,
    stops: segment.stops,
    source: 'manual',
  }));
}

export async function buildRoutePath(route, mode) {
  const sortedPoints = [...route.points].sort((a, b) => a.order - b.order);
  const coordinates = sortedPoints.map((p) => [p.coordinates.lat, p.coordinates.lon]);

  if (sortedPoints.length < 2) {
    return { coordinates, transportSegments: [] };
  }

  const key = process.env.YANDEX_MAPS_API_KEY;
  const baseUrl = process.env.YANDEX_ROUTER_BASE_URL;

  if (!key || !baseUrl) {
    return {
      coordinates,
      transportSegments: buildFallback(route, mode),
      source: 'fallback',
    };
  }

  try {
    const waypoints = sortedPoints.map(toPoint).join('~');
    const response = await axios.get(baseUrl, {
      params: {
        apikey: key,
        waypoints,
        mode,
      },
      timeout: 7000,
    });

    const data = response.data || {};
    const transportSegments = data.transportSegments || [];

    return {
      coordinates: data.coordinates || coordinates,
      transportSegments:
        mode === 'masstransit' && transportSegments.length === 0
          ? buildFallback(route, mode)
          : transportSegments,
      source: 'yandex',
    };
  } catch {
    return {
      coordinates,
      transportSegments: buildFallback(route, mode),
      source: 'fallback',
    };
  }
}

