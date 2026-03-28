import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { load } from '@2gis/mapgl';
import { getRouteBounds } from '../lib/geo';

const DEFAULT_CENTER = [39.7446, 54.6296];

function buildFallbackGeometry(points = []) {
  return points
    .filter((point) => point?.coordinates)
    .map((point) => [point.coordinates.lon, point.coordinates.lat]);
}

function getPointMarkerVariant(point, completedPointOrders, currentPointOrder, playMode) {
  if (point.pointType === 'waypoint') {
    return 'waypoint';
  }

  if (completedPointOrders.includes(point.order)) {
    return 'done';
  }

  if (point.order === currentPointOrder) {
    return 'current';
  }

  return playMode === 'thematic' ? 'locked' : 'pending';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createPointMarkerHtml(point, variant) {
  const isWaypoint = point.pointType === 'waypoint';
  const order = Number.isFinite(point.order) && !isWaypoint ? point.order : '•';
  const title = escapeHtml(point.title);
  const subtitle = escapeHtml(point.address || point.description || 'Рязань');
  return `
    <button class="map-pin map-pin--${variant} ${isWaypoint ? 'map-pin--scenic' : ''}" type="button" aria-label="${title}">
      <span class="map-pin__badge">${order}</span>
      <span class="map-pin__tail" aria-hidden="true"></span>
      <span class="map-tooltip" role="tooltip">
        <strong>${title}</strong>
        <small>${subtitle}</small>
      </span>
    </button>
  `;
}

function fitMap(map, geometry, fallbackGeometry) {
  const routeGeometry = geometry?.length > 1 ? geometry : fallbackGeometry;
  const normalized = (routeGeometry || []).filter(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      point[0] >= -180 &&
      point[0] <= 180 &&
      point[1] >= -90 &&
      point[1] <= 90
  );

  if (!normalized.length) {
    return;
  }

  if (normalized.length < 2) {
    map.setCenter(normalized[0], { duration: 400 });
    return;
  }

  const bounds = getRouteBounds(normalized);
  if (!bounds || !Array.isArray(bounds.southWest) || !Array.isArray(bounds.northEast)) {
    map.setCenter(normalized[0], { duration: 400 });
    return;
  }

  try {
    map.fitBounds(bounds, { padding: [48, 48, 48, 48] });
  } catch (error) {
    console.error('Map fitBounds failed, fallback to setCenter', error);
    map.setCenter(normalized[0], { duration: 400 });
  }
}

export default function RouteMap({
  points = [],
  navigationGeometry = [],
  completedPointOrders = [],
  currentPointOrder = null,
  playMode = 'thematic',
  onPointSelect,
  mapStatus = 'ready',
}) {
  const mapKey = import.meta.env.VITE_2GIS_MAPGL_KEY;
  const hasMapApiKey = Boolean(mapKey && !mapKey.startsWith('your-'));
  const containerId = useId().replace(/:/g, '-');
  const mapApiRef = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef([]);
  const pointMarkersRef = useRef([]);
  const [mapError, setMapError] = useState('');
  const fallbackGeometry = useMemo(() => buildFallbackGeometry(points), [points]);

  useEffect(() => {
    if (!hasMapApiKey) {
      return undefined;
    }

    let cancelled = false;

    load()
      .then((mapgl) => {
        if (cancelled) {
          return;
        }

        mapApiRef.current = mapgl;
        mapRef.current = new mapgl.Map(containerId, {
          center: DEFAULT_CENTER,
          zoom: 13,
          key: mapKey,
        });
        setMapError('');
      })
      .catch((err) => {
        setMapError(err.message || 'Не удалось загрузить карту 2GIS.');
      });

    return () => {
      cancelled = true;

      for (const polyline of routeRef.current) {
        polyline.destroy();
      }
      for (const marker of pointMarkersRef.current) {
        marker.destroy();
      }
      mapRef.current?.destroy();

      routeRef.current = [];
      pointMarkersRef.current = [];
      mapRef.current = null;
      mapApiRef.current = null;
    };
  }, [containerId, hasMapApiKey, mapKey]);

  useEffect(() => {
    const map = mapRef.current;
    const mapgl = mapApiRef.current;
    if (!map || !mapgl) {
      return;
    }

    for (const polyline of routeRef.current) {
      polyline.destroy();
    }

    routeRef.current = [];

    if (navigationGeometry.length > 1) {
      routeRef.current.push(
        new mapgl.Polyline(map, {
          coordinates: navigationGeometry,
          color: '#d8eee6',
          width: 11,
          zIndex: 1,
        })
      );
      routeRef.current.push(
        new mapgl.Polyline(map, {
          coordinates: navigationGeometry,
          color: '#12664f',
          width: 6,
          zIndex: 2,
        })
      );
    }

    fitMap(map, navigationGeometry, fallbackGeometry);
  }, [fallbackGeometry, navigationGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    const mapgl = mapApiRef.current;
    if (!map || !mapgl) {
      return;
    }

    for (const marker of pointMarkersRef.current) {
      marker.destroy();
    }
    pointMarkersRef.current = [];

    pointMarkersRef.current = points
      .filter((point) => point?.coordinates)
      .map((point) => {
        const variant = getPointMarkerVariant(point, completedPointOrders, currentPointOrder, playMode);
        const marker = new mapgl.HtmlMarker(map, {
          coordinates: [point.coordinates.lon, point.coordinates.lat],
          html: createPointMarkerHtml(point, variant),
          anchor: [17, 39],
          interactive: true,
        });
        marker.getContent().addEventListener('click', () => onPointSelect?.(point));
        return marker;
      });
  }, [completedPointOrders, currentPointOrder, onPointSelect, playMode, points]);

  if (!hasMapApiKey) {
    return (
      <div className="map-wrap">
        <div className="map-fallback">
          <p className="status-note">Карта 2GIS отключена: не задан `VITE_2GIS_MAPGL_KEY`.</p>
          <p>Маршрут и точки остаются доступны ниже, поэтому экран продолжает работать даже без карты.</p>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="map-wrap">
        <div className="map-fallback">
          <p className="status-note">{mapError}</p>
          <p>Оставляем список точек и игровой flow активными, даже если карта временно не загрузилась.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div className={`map-canvas map-canvas--${mapStatus}`} id={containerId} />
    </div>
  );
}
