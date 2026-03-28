const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  getRoutes: () => request('/routes'),
  getRouteById: (routeId) => request(`/routes/${routeId}`),
  buildRoute: (routeId) =>
    request(`/routes/${routeId}/build`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getRouteProgress: (routeId, sessionId, playMode) =>
    request(`/routes/${routeId}/progress?sessionId=${encodeURIComponent(sessionId)}&playMode=${playMode}`),
  scanRoutePoint: (routeId, payload) =>
    request(`/routes/${routeId}/scan`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitPointQuiz: (routeId, payload) =>
    request(`/routes/${routeId}/quiz`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getNearbyDiscovery: ({ lat, lon, radius = 3000, groups = [] }) =>
    request(
      `/discovery/nearby?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radius)}&groups=${encodeURIComponent(groups.join(','))}`
    ),
  searchDiscovery: ({ query, lat, lon, radius = 5000 }) =>
    request(
      `/discovery/search?query=${encodeURIComponent(query)}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radius)}`
    ),
  buildNavigationRoute: (payload) =>
    request('/navigation/route', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminLogin: (payload) =>
    request('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminRefresh: (payload) =>
    request('/admin/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminLogout: (payload) =>
    request('/admin/auth/logout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createRoute: (token, payload) =>
    request('/admin/routes', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  updateRoute: (token, routeId, payload) =>
    request(`/admin/routes/${routeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  deleteRoute: (token, routeId) =>
    request(`/admin/routes/${routeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
  addPoint: (token, routeId, payload) =>
    request(`/admin/routes/${routeId}/points`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  updatePoint: (token, routeId, pointId, payload) =>
    request(`/admin/routes/${routeId}/points/${pointId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  deletePoint: (token, routeId, pointId) =>
    request(`/admin/routes/${routeId}/points/${pointId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};
