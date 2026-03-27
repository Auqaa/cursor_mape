import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { loadProgress, resetProgress, saveProgress } from '../lib/storage';
import RouteMap from '../components/RouteMap';

function getCurrentTimestamp() {
  return Number(new Date());
}

function toPolylineCoordinates(path) {
  return (path || []).map((item) => [item[0], item[1]]);
}

export default function RouteDetailsPage() {
  const { id } = useParams();
  const [route, setRoute] = useState(null);
  const [mode, setMode] = useState('walking');
  const [builtRoute, setBuiltRoute] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    api
      .getRouteById(id)
      .then((data) => {
        setRoute(data);
        const cached = loadProgress(id);
        setProgress(
          cached || {
            startedAt: getCurrentTimestamp(),
            completedOrders: [],
          }
        );
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!route) return;
    api
      .buildRoute(id, mode)
      .then(setBuiltRoute)
      .catch((err) => setError(err.message));
  }, [id, mode, route]);

  const sortedPoints = useMemo(
    () => [...(route?.points || [])].sort((a, b) => a.order - b.order),
    [route]
  );

  const completePoint = (order) => {
    if (!progress) return;
    if (progress.completedOrders.includes(order)) return;
    const next = {
      ...progress,
      completedOrders: [...progress.completedOrders, order],
      finishedAt:
        progress.completedOrders.length + 1 >= sortedPoints.length
          ? getCurrentTimestamp()
          : progress.finishedAt,
    };
    setProgress(next);
    saveProgress(id, next);
  };

  const restartProgress = () => {
    const next = { startedAt: getCurrentTimestamp(), completedOrders: [] };
    setProgress(next);
    resetProgress(id);
  };

  const allDone = sortedPoints.length > 0 && progress?.completedOrders.length === sortedPoints.length;
  const elapsedMinutes = progress?.finishedAt
    ? Math.round((progress.finishedAt - progress.startedAt) / 60000)
    : null;

  return (
    <section>
      {error && <p className="error">{error}</p>}
      {!route && !error && <p>Загрузка маршрута...</p>}
      {route && (
        <>
          <h1>{route.title}</h1>
          <p>{route.description}</p>
          <div className="mode-switch">
            <button className={mode === 'walking' ? 'btn active' : 'btn'} onClick={() => setMode('walking')}>
              Пешком
            </button>
            <button
              className={mode === 'masstransit' ? 'btn active' : 'btn'}
              onClick={() => setMode('masstransit')}
            >
              С транспортом
            </button>
          </div>

          <RouteMap points={sortedPoints} pathCoordinates={toPolylineCoordinates(builtRoute?.coordinates)} />

          {mode === 'masstransit' && (
            <div className="transport-list">
              <h3>Транспортные сегменты</h3>
              {(builtRoute?.transportSegments || []).length === 0 && <p>Нет данных о транспорте</p>}
              {(builtRoute?.transportSegments || []).map((segment, idx) => (
                <div key={`${segment.routeNumber}-${idx}`} className="transport-item">
                  <strong>
                    Маршрут {segment.routeNumber} ({segment.vehicleType})
                  </strong>
                  <p>
                    От точки {segment.fromPointOrder} до {segment.toPointOrder}
                  </p>
                  <p>
                    Остановки:{' '}
                    {(segment.stops || [])
                      .map((s) => (typeof s === 'string' ? s : s.name))
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="points">
            <h3>Этапы маршрута</h3>
            {sortedPoints.map((point) => {
              const isDone = progress?.completedOrders.includes(point.order);
              return (
                <article key={point._id || point.order} className="point">
                  <h4>
                    {point.order}. {point.title}
                  </h4>
                  <p>{point.description}</p>
                  <button className="btn" disabled={isDone} onClick={() => completePoint(point.order)}>
                    {isDone ? 'Точка пройдена' : 'Сканировать QR-код (имитация)'}
                  </button>
                </article>
              );
            })}
          </div>

          {allDone && (
            <div className="success">
              <h3>Поздравляем! Маршрут пройден.</h3>
              <p>Пройдено точек: {sortedPoints.length}</p>
              <p>Время прохождения: {elapsedMinutes ?? 0} мин</p>
              <button className="btn" onClick={restartProgress}>
                Пройти заново
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

