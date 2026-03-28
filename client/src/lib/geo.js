const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(from, to) {
  if (!from || !to) {
    return null;
  }

  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lon - from.lon);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine)));
}

export function getRouteBounds(points = []) {
  const normalized = points.filter(
    (point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
  );

  if (!normalized.length) {
    return null;
  }

  let minLon = normalized[0][0];
  let maxLon = normalized[0][0];
  let minLat = normalized[0][1];
  let maxLat = normalized[0][1];

  for (const [lon, lat] of normalized) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return {
    southWest: [minLon, minLat],
    northEast: [maxLon, maxLat],
  };
}

function projectPoint({ lat, lon }, baseLat) {
  return {
    x: lon * Math.cos(toRadians(baseLat)) * 111320,
    y: lat * 110540,
  };
}

function getDistanceToSegmentMeters(point, segmentStart, segmentEnd) {
  const baseLat = (point.lat + segmentStart.lat + segmentEnd.lat) / 3;
  const projectedPoint = projectPoint(point, baseLat);
  const projectedStart = projectPoint(segmentStart, baseLat);
  const projectedEnd = projectPoint(segmentEnd, baseLat);
  const deltaX = projectedEnd.x - projectedStart.x;
  const deltaY = projectedEnd.y - projectedStart.y;

  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(projectedPoint.x - projectedStart.x, projectedPoint.y - projectedStart.y);
  }

  const t =
    ((projectedPoint.x - projectedStart.x) * deltaX + (projectedPoint.y - projectedStart.y) * deltaY) /
    (deltaX * deltaX + deltaY * deltaY);
  const clamped = Math.max(0, Math.min(1, t));
  const closestX = projectedStart.x + deltaX * clamped;
  const closestY = projectedStart.y + deltaY * clamped;

  return Math.hypot(projectedPoint.x - closestX, projectedPoint.y - closestY);
}

export function getDistanceToPolylineMeters(point, polyline = []) {
  if (!point || !Array.isArray(polyline) || polyline.length < 2) {
    return null;
  }

  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < polyline.length; index += 1) {
    const previous = polyline[index - 1];
    const current = polyline[index];

    if (!Array.isArray(previous) || !Array.isArray(current)) {
      continue;
    }

    const distance = getDistanceToSegmentMeters(
      point,
      { lon: previous[0], lat: previous[1] },
      { lon: current[0], lat: current[1] }
    );
    bestDistance = Math.min(bestDistance, distance);
  }

  return Number.isFinite(bestDistance) ? Math.round(bestDistance) : null;
}
