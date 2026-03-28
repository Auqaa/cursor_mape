import { fetchNearbyPois, searchPois } from '../services/dgis.service.js';

function parseGroups(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getNearbyDiscovery(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radius = Number(req.query.radius) || 3000;
    const groups = parseGroups(req.query.groups);

    const result = await fetchNearbyPois({ lat, lon, radius, groups });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchDiscovery(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radius = Number(req.query.radius) || 5000;
    const query = req.query.query;

    const result = await searchPois({ query, lat, lon, radius });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
