import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

const emptyRoute = {
  title: '',
  description: '',
  distanceKm: 1,
  durationMinutes: 30,
  city: 'Рязань',
  points: [],
};

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('admin_access_token') || '');
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('admin_refresh_token') || '');
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('admin123');
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedRouteDetails, setSelectedRouteDetails] = useState(null);
  const [draft, setDraft] = useState(emptyRoute);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchRoutes = useCallback(async () => {
    try {
      const data = await api.getRoutes();
      setRoutes(data);
      if (!selectedRouteId && data[0]?._id) {
        setSelectedRouteId(data[0]._id);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (!selectedRouteId) {
      setSelectedRouteDetails(null);
      return;
    }
    api
      .getRouteById(selectedRouteId)
      .then(setSelectedRouteDetails)
      .catch((err) => setError(err.message));
  }, [selectedRouteId]);

  const withRefresh = async (fn) => {
    try {
      return await fn(token);
    } catch (err) {
      if (!refreshToken) throw err;
      const refreshed = await api.adminRefresh({ refreshToken });
      setToken(refreshed.accessToken);
      setRefreshToken(refreshed.refreshToken);
      localStorage.setItem('admin_access_token', refreshed.accessToken);
      localStorage.setItem('admin_refresh_token', refreshed.refreshToken);
      return fn(refreshed.accessToken);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setError('');
    const data = await api.adminLogin({ email, password });
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    localStorage.setItem('admin_access_token', data.accessToken);
    localStorage.setItem('admin_refresh_token', data.refreshToken);
    setMessage('Вход выполнен');
  };

  const logout = async () => {
    try {
      await api.adminLogout({ refreshToken });
    } finally {
      setToken('');
      setRefreshToken('');
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
    }
  };

  const createRoute = async () => {
    const created = await withRefresh((access) => api.createRoute(access, draft));
    setMessage('Маршрут создан');
    await fetchRoutes();
    setSelectedRouteId(created._id);
    setDraft(emptyRoute);
  };

  const removeRoute = async () => {
    if (!selectedRouteId) return;
    await withRefresh((access) => api.deleteRoute(access, selectedRouteId));
    setMessage('Маршрут удален');
    setSelectedRouteId('');
    await fetchRoutes();
  };

  const addPoint = async () => {
    if (!selectedRouteId) return;
    const pointOrder = (selectedRouteDetails?.points?.length || 0) + 1;
    await withRefresh((access) =>
      api.addPoint(access, selectedRouteId, {
        title: `Новая точка ${pointOrder}`,
        description: 'Добавьте описание',
        order: pointOrder,
        pointType: 'checkpoint',
        source: 'curated',
        qrCode: `new-point-${Date.now()}`,
        manualCode: `${9000 + pointOrder}`,
        coordinates: { lat: 54.6269, lon: 39.6916 },
      })
    );
    setMessage('Точка добавлена');
    await fetchRoutes();
  };

  return (
    <section>
      <h1>Админ-панель</h1>
      {!token && (
        <form className="admin-login" onSubmit={login}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />
          <button className="btn" type="submit">
            Войти
          </button>
        </form>
      )}
      {token && (
        <div className="admin-body">
          <div className="admin-actions">
            <button className="btn" onClick={logout}>
              Выйти
            </button>
            <button className="btn" onClick={fetchRoutes}>
              Обновить
            </button>
          </div>

          <div className="admin-grid">
            <div>
              <h3>Маршруты</h3>
              {routes.map((route) => (
                <button
                  key={route._id}
                  className={selectedRouteId === route._id ? 'btn active' : 'btn'}
                  onClick={() => setSelectedRouteId(route._id)}
                >
                  {route.title}
                </button>
              ))}
            </div>

            <div>
              <h3>Создать маршрут</h3>
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Название"
              />
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Описание"
              />
              <button className="btn" onClick={createRoute}>
                Создать
              </button>
            </div>

            <div>
              <h3>Управление выбранным маршрутом</h3>
              <button className="btn" onClick={addPoint} disabled={!selectedRouteId}>
                Добавить точку
              </button>
              <button className="btn danger" onClick={removeRoute} disabled={!selectedRouteId}>
                Удалить маршрут
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <p className="success-text">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
