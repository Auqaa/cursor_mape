import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function RoutesListPage() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getRoutes()
      .then(setRoutes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h1>Маршруты по Рязани</h1>
      {loading && <p>Загрузка маршрутов...</p>}
      {error && <p className="error">{error}</p>}
      <div className="cards">
        {routes.map((route) => (
          <article key={route._id} className="card">
            <h2>{route.title}</h2>
            <p>{route.description}</p>
            <p>
              Дистанция: {route.distanceKm} км | Длительность: {route.durationMinutes} мин
            </p>
            <Link className="btn" to={`/routes/${route._id}`}>
              Открыть маршрут
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

