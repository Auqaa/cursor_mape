import { YMaps, Map, Placemark, Polyline } from '@pbe/react-yandex-maps';

const DEFAULT_CENTER = [54.6269, 39.6916];

export default function RouteMap({ points = [], pathCoordinates = [] }) {
  const apiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
  const mapState = {
    center: points[0] ? [points[0].coordinates.lat, points[0].coordinates.lon] : DEFAULT_CENTER,
    zoom: 13,
  };

  return (
    <div className="map-wrap">
      <YMaps query={{ apikey: apiKey, lang: 'ru_RU' }}>
        <Map width="100%" height="320px" defaultState={mapState}>
          {points.map((point) => (
            <Placemark
              key={point._id || `${point.order}-${point.title}`}
              geometry={[point.coordinates.lat, point.coordinates.lon]}
              properties={{ balloonContent: `${point.order}. ${point.title}` }}
            />
          ))}
          {pathCoordinates.length > 1 && (
            <Polyline geometry={pathCoordinates} options={{ strokeColor: '#3B82F6', strokeWidth: 4 }} />
          )}
        </Map>
      </YMaps>
    </div>
  );
}

