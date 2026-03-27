const PREFIX = 'ryazan_route_progress';

export function loadProgress(routeId) {
  const raw = localStorage.getItem(`${PREFIX}_${routeId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProgress(routeId, progress) {
  localStorage.setItem(`${PREFIX}_${routeId}`, JSON.stringify(progress));
}

export function resetProgress(routeId) {
  localStorage.removeItem(`${PREFIX}_${routeId}`);
}

