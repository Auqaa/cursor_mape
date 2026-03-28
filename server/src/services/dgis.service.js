import axios from 'axios';
import { HttpError } from '../utils/http-error.js';

const DEFAULT_PLACES_BASE_URL = 'https://catalog.api.2gis.com/3.0';
const DEFAULT_ROUTING_BASE_URL = 'https://routing.api.2gis.com/routing/7.0.0/global';
const CACHE_TTL_MS = 5 * 60 * 1000;
const WALKING_SPEED_METERS_PER_SECOND = 1.35;

const DISCOVERY_QUERIES = {
  attractions: ['достопримечательность', 'музей', 'театр', 'парк', 'набережная'],
  food: ['кафе', 'ресторан', 'кофейня', 'пекарня'],
  hotels: ['отель', 'гостиница', 'апартаменты', 'хостел'],
  shops: ['магазин', 'сувениры', 'торговый центр'],
};

const cache = new Map();

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function getCachedValue(key) {
  cleanupCache();
  const item = cache.get(key);
  return item ? item.value : null;
}

function setCachedValue(key, value, ttl = CACHE_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
  return value;
}

function getSharedApiKey() {
  return (
    process.env.DGIS_API_KEY ||
    process.env.DGIS_PLACES_API_KEY ||
    process.env.DGIS_ROUTING_API_KEY ||
    ''
  );
}

function getPlacesApiKey() {
  return process.env.DGIS_PLACES_API_KEY || getSharedApiKey();
}

function getRoutingApiKey() {
  return process.env.DGIS_ROUTING_API_KEY || getSharedApiKey();
}

function ensureApiKey(value, label) {
  if (!value) {
    throw new HttpError(500, `${label} is not set`);
  }
}

function buildCacheKey(prefix, payload) {
  return `${prefix}:${JSON.stringify(payload)}`;
}

function toNumber(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function normalizeCoordinates(point, label = 'point') {
  if (!point) {
    throw new HttpError(400, `${label} is required`);
  }

  const lat = toNumber(point.lat ?? point.latitude);
  const lon = toNumber(point.lon ?? point.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpError(400, `${label} must include valid lat/lon coordinates`);
  }

  return { lat, lon };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(from, to) {
  const fromPoint = normalizeCoordinates(from, 'from');
  const toPoint = normalizeCoordinates(to, 'to');
  const latitudeDelta = toRadians(toPoint.lat - fromPoint.lat);
  const longitudeDelta = toRadians(toPoint.lon - fromPoint.lon);
  const fromLatitude = toRadians(fromPoint.lat);
  const toLatitude = toRadians(toPoint.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.sqrt(haversine));
}

function getMidpoint(from, to) {
  return {
    lat: (from.lat + to.lat) / 2,
    lon: (from.lon + to.lon) / 2,
  };
}

function projectPoint(point, baseLat) {
  const x = point.lon * Math.cos(toRadians(baseLat)) * 111320;
  const y = point.lat * 110540;
  return { x, y };
}

function getDistanceToSegmentMeters(point, segmentStart, segmentEnd) {
  const baseLat = (segmentStart.lat + segmentEnd.lat + point.lat) / 3;
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
  const clampedT = Math.max(0, Math.min(1, t));
  const closestX = projectedStart.x + deltaX * clampedT;
  const closestY = projectedStart.y + deltaY * clampedT;

  return Math.hypot(projectedPoint.x - closestX, projectedPoint.y - closestY);
}

function dedupeById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.externalId || item.id || `${item.title}-${item.coordinates?.lat}-${item.coordinates?.lon}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizePoi(item, group) {
  if (!item?.point?.lat || !item?.point?.lon) {
    return null;
  }

  return {
    id: `${group}-${item.id}`,
    externalId: item.id,
    title: item.name || item.full_name || 'Точка 2GIS',
    subtitle: item.purpose_name || item.type || '',
    address: item.address_name || item.full_name || '',
    group,
    source: 'dgis',
    coordinates: {
      lat: item.point.lat,
      lon: item.point.lon,
    },
  };
}

function parseLineString(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('LINESTRING(')) {
    return [];
  }

  return value
    .replace(/^LINESTRING\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([lon, lat]) => [lon, lat]);
}

function dedupeGeometry(geometry) {
  return geometry.filter((point, index) => {
    const prev = geometry[index - 1];
    return !prev || prev[0] !== point[0] || prev[1] !== point[1];
  });
}

function extractRouteGeometry(route) {
  const parts = [];

  if (route.begin_pedestrian_path?.geometry?.selection) {
    parts.push(...parseLineString(route.begin_pedestrian_path.geometry.selection));
  }

  for (const maneuver of route.maneuvers || []) {
    for (const geometry of maneuver.outcoming_path?.geometry || []) {
      parts.push(...parseLineString(geometry.selection));
    }

    if (maneuver.geometry?.selection) {
      parts.push(...parseLineString(maneuver.geometry.selection));
    }
  }

  if (route.end_pedestrian_path?.geometry?.selection) {
    parts.push(...parseLineString(route.end_pedestrian_path.geometry.selection));
  }

  return dedupeGeometry(parts);
}

function formatDistanceText(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return null;
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} м`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} км`;
}

function formatDurationText(durationSeconds) {
  if (!Number.isFinite(durationSeconds)) {
    return null;
  }

  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} мин`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

function buildFallbackRoute({ origin, destination, waypoints = [] }) {
  const chain = [origin, ...waypoints, destination].map((point) => normalizeCoordinates(point));
  const directDistance = chain.reduce((total, point, index) => {
    if (index === 0) {
      return total;
    }

    return total + getDistanceMeters(chain[index - 1], point);
  }, 0);
  const paddedDistance = Math.round(directDistance * 1.18);
  const durationSeconds = Math.round(paddedDistance / WALKING_SPEED_METERS_PER_SECOND);

  return {
    source: 'fallback',
    geometry: chain.map((point) => [point.lon, point.lat]),
    summary: {
      distanceMeters: paddedDistance,
      durationSeconds,
      distanceText: formatDistanceText(paddedDistance),
      durationText: formatDurationText(durationSeconds),
    },
    maneuvers: [],
  };
}

async function requestPlaces(params) {
  const key = getPlacesApiKey();
  ensureApiKey(key, 'DGIS_PLACES_API_KEY');

  const response = await axios.get(`${process.env.DGIS_PLACES_BASE_URL || DEFAULT_PLACES_BASE_URL}/items`, {
    params: {
      key,
      locale: 'ru_RU',
      fields: 'items.point,items.address_name,items.full_name,items.purpose_name',
      ...params,
    },
    timeout: 8000,
  });

  return response.data?.result?.items || [];
}

async function fetchNearbyGroup({ lat, lon, radius, group, pageSize = 10 }) {
  const queries = DISCOVERY_QUERIES[group];
  if (!queries) {
    return [];
  }

  const cacheKey = buildCacheKey('nearby-group', { lat, lon, radius, group, pageSize });
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  const searchResults = await Promise.all(
    queries.map((query) =>
      requestPlaces({
        q: query,
        sort_point: `${lon},${lat}`,
        radius,
        page_size: pageSize,
      })
    )
  );

  const normalized = dedupeById(searchResults.flat().map((item) => normalizePoi(item, group)).filter(Boolean));
  return setCachedValue(cacheKey, normalized.slice(0, pageSize));
}

export async function fetchNearbyPois({ lat, lon, radius = 3000, groups = [] }) {
  const origin = normalizeCoordinates({ lat, lon }, 'origin');
  const requestedGroups = groups.length ? groups.filter((group) => DISCOVERY_QUERIES[group]) : Object.keys(DISCOVERY_QUERIES);

  const resultEntries = await Promise.all(
    requestedGroups.map(async (group) => [group, await fetchNearbyGroup({ ...origin, radius, group })])
  );

  return {
    origin,
    radius,
    groups: Object.fromEntries(resultEntries),
  };
}

export async function searchPois({ query, lat, lon, radius = 5000, pageSize = 8 }) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    throw new HttpError(400, 'Query is required');
  }

  const origin = normalizeCoordinates({ lat, lon }, 'origin');
  const cacheKey = buildCacheKey('search', { query: normalizedQuery, ...origin, radius, pageSize });
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return { query: normalizedQuery, origin, items: cached };
  }

  const items = await requestPlaces({
    q: normalizedQuery,
    sort_point: `${origin.lon},${origin.lat}`,
    radius,
    page_size: pageSize,
  });
  const normalizedItems = dedupeById(items.map((item) => normalizePoi(item, 'search')).filter(Boolean));

  setCachedValue(cacheKey, normalizedItems);

  return {
    query: normalizedQuery,
    origin,
    items: normalizedItems,
  };
}

export async function chooseScenicWaypoints({ origin, destination, limit = 3 }) {
  const from = normalizeCoordinates(origin, 'origin');
  const to = normalizeCoordinates(destination, 'destination');
  const distanceMeters = getDistanceMeters(from, to);
  const midpoint = getMidpoint(from, to);
  const radius = Math.max(1500, Math.min(5500, Math.round(distanceMeters * 0.65)));
  const attractionPool = await fetchNearbyGroup({
    lat: midpoint.lat,
    lon: midpoint.lon,
    radius,
    group: 'attractions',
    pageSize: 18,
  });

  return attractionPool
    .map((item) => {
      const distanceToLine = getDistanceToSegmentMeters(item.coordinates, from, to);
      const detourPenalty =
        getDistanceMeters(from, item.coordinates) + getDistanceMeters(item.coordinates, to) - distanceMeters;

      return {
        ...item,
        score: distanceToLine * 0.9 + detourPenalty * 0.2,
        distanceToLine,
        detourPenalty,
      };
    })
    .filter(
      (item) =>
        getDistanceMeters(from, item.coordinates) > 180 &&
        getDistanceMeters(to, item.coordinates) > 180 &&
        item.distanceToLine < 850 &&
        item.detourPenalty < 1800
    )
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      externalId: item.externalId,
      source: 'dgis',
      pointType: 'waypoint',
      coordinates: item.coordinates,
    }));
}

export async function buildWalkingRoute({ origin, destination, waypoints = [], locale = 'ru' }) {
  const key = getRoutingApiKey();
  ensureApiKey(key, 'DGIS_ROUTING_API_KEY');

  const normalizedOrigin = normalizeCoordinates(origin, 'origin');
  const normalizedDestination = normalizeCoordinates(destination, 'destination');
  const normalizedWaypoints = waypoints.map((point, index) => normalizeCoordinates(point, `waypoint ${index + 1}`));
  const points = [
    {
      lat: normalizedOrigin.lat,
      lon: normalizedOrigin.lon,
      type: 'walking',
      start: true,
    },
    ...normalizedWaypoints.map((point) => ({
      lat: point.lat,
      lon: point.lon,
      type: 'pref',
    })),
    {
      lat: normalizedDestination.lat,
      lon: normalizedDestination.lon,
      type: 'walking',
    },
  ];

  if (points.length < 2) {
    throw new HttpError(400, 'At least origin and destination are required');
  }

  const cacheKey = buildCacheKey('walking-route', { points, locale });
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await axios.post(
      process.env.DGIS_ROUTING_BASE_URL || DEFAULT_ROUTING_BASE_URL,
      {
        points,
        transport: 'walking',
        output: 'detailed',
        locale,
      },
      {
        params: { key },
        timeout: 10_000,
      }
    );

    if (response.data?.type !== 'result' || response.data?.status !== 'OK' || !response.data?.result?.[0]) {
      throw new Error(response.data?.message || 'Routing API did not return a route');
    }

    const route = response.data.result[0];
    const geometry = extractRouteGeometry(route);
    const builtRoute = {
      source: '2gis',
      geometry,
      summary: {
        distanceMeters: route.total_distance || 0,
        durationSeconds: route.total_duration || 0,
        distanceText:
          route.ui_total_distance?.value && route.ui_total_distance?.unit
            ? `${route.ui_total_distance.value} ${route.ui_total_distance.unit}`
            : formatDistanceText(route.total_distance || 0),
        durationText: route.ui_total_duration || formatDurationText(route.total_duration || 0),
      },
      maneuvers: (route.maneuvers || []).map((maneuver) => ({
        id: maneuver.id,
        icon: maneuver.icon,
        comment: maneuver.comment,
        summary: maneuver.outcoming_path_comment,
      })),
    };

    return setCachedValue(cacheKey, builtRoute);
  } catch (err) {
    console.error('2GIS walking route failed', {
      message: err.response?.data?.message || err.message,
      status: err.response?.status || null,
      pointsCount: points.length,
    });
    return buildFallbackRoute({
      origin: normalizedOrigin,
      destination: normalizedDestination,
      waypoints: normalizedWaypoints,
    });
  }
}
