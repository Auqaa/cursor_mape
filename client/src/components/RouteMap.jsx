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

function createPointMarkerHtml(point, variant) {
  const order = Number.isFinite(point.order) ? point.order : '•';
  return `
    <button class="map-pin map-pin--${variant}" type="button" aria-label="${point.title}">
      <span>${order}</span>
    </button>
  `;
}

function createPoiMarkerHtml(poi, selected) {
  return `
    <button class="poi-pin poi-pin--${poi.group || 'default'} ${selected ? 'poi-pin--selected' : ''}" type="button" aria-label="${poi.title}">
      <span>${poi.group === 'food' ? '☕' : poi.group === 'hotels' ? '🛏' : poi.group === 'shops' ? '🛍' : '✦'}</span>
    </button>
  `;
}

function createUserMarkerHtml() {
  return `
    <div class="user-pin" aria-label="Вы здесь">
      <span></span>
    </div>
  `;
}

function fitMap(map, geometry, fallbackGeometry) {
  const bounds = getRouteBounds(geometry?.length > 1 ? geometry : fallbackGeometry);
  if (bounds) {
    map.fitBounds(bounds, { padding: [48, 48, 48, 48] });
  }
}

export default function RouteMap({
  points = [],
  navigationGeometry = [],
  completedPointOrders = [],
  currentPointOrder = null,
  playMode = 'thematic',
  userPosition = null,
  pois = [],
  selectedPoiId = '',
  onPointSelect,
  onPoiSelect,
  recenterTick = 0,
  mapStatus = 'ready',
}) {
  const mapKey = import.meta.env.VITE_2GIS_MAPGL_KEY;
  const hasMapApiKey = Boolean(mapKey && !mapKey.startsWith('your-'));
  const containerId = useId().replace(/:/g, '-');
  const mapApiRef = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef([]);
  const pointMarkersRef = useRef([]);
  const poiMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
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
          center: fallbackGeometry[0] || DEFAULT_CENTER,
          zoom: 13,
          key: mapKey,
        });
        fitMap(mapRef.current, navigationGeometry, fallbackGeometry);
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
      for (const marker of poiMarkersRef.current) {
        marker.destroy();
      }
      userMarkerRef.current?.destroy();
      mapRef.current?.destroy();

      routeRef.current = [];
      pointMarkersRef.current = [];
      poiMarkersRef.current = [];
      userMarkerRef.current = null;
      mapRef.current = null;
      mapApiRef.current = null;
    };
  }, [containerId, fallbackGeometry, hasMapApiKey, mapKey, navigationGeometry]);

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

    const geometry = navigationGeometry?.length > 1 ? navigationGeometry : fallbackGeometry;
    if (geometry.length > 1) {
      routeRef.current.push(
        new mapgl.Polyline(map, {
          coordinates: geometry,
          color: '#d8eee6',
          width: 11,
          zIndex: 1,
        })
      );
      routeRef.current.push(
        new mapgl.Polyline(map, {
          coordinates: geometry,
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
          anchor: [18, 18],
          interactive: true,
        });
        marker.getContent().addEventListener('click', () => onPointSelect?.(point));
        return marker;
      });
  }, [completedPointOrders, currentPointOrder, onPointSelect, playMode, points]);

  useEffect(() => {
    const map = mapRef.current;
    const mapgl = mapApiRef.current;
    if (!map || !mapgl) {
      return;
    }

    for (const marker of poiMarkersRef.current) {
      marker.destroy();
    }
    poiMarkersRef.current = [];

    poiMarkersRef.current = pois
      .filter((poi) => poi?.coordinates)
      .map((poi) => {
        const marker = new mapgl.HtmlMarker(map, {
          coordinates: [poi.coordinates.lon, poi.coordinates.lat],
          html: createPoiMarkerHtml(poi, selectedPoiId === poi.id),
          anchor: [16, 16],
          interactive: true,
        });
        marker.getContent().addEventListener('click', () => onPoiSelect?.(poi));
        return marker;
      });
  }, [onPoiSelect, pois, selectedPoiId]);

  useEffect(() => {
    const map = mapRef.current;
    const mapgl = mapApiRef.current;
    if (!map || !mapgl) {
      return;
    }

    if (!userPosition) {
      userMarkerRef.current?.destroy();
      userMarkerRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = new mapgl.HtmlMarker(map, {
        coordinates: [userPosition.lon, userPosition.lat],
        html: createUserMarkerHtml(),
        anchor: [14, 14],
        interactive: false,
      });
    } else {
      userMarkerRef.current.setCoordinates([userPosition.lon, userPosition.lat]);
    }
  }, [userPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) {
      return;
    }

    map.setCenter([userPosition.lon, userPosition.lat], { duration: 550 });
  }, [recenterTick, userPosition]);

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
