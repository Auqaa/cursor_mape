const PROGRESS_PREFIX = 'ryazan_route_progress_v3';
const SETTINGS_KEY = 'ryazan_route_settings_v1';
const SESSION_KEY = 'ryazan_route_session_id';
const PROFILE_EVENT = 'ryazan-progress-updated';

function safeParse(raw, fallback) {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function emitProgressUpdate() {
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

function progressKey(routeId, playMode = 'thematic') {
  return `${PROGRESS_PREFIX}_${routeId}_${playMode}`;
}

export function getSessionId() {
  const existingSession = localStorage.getItem(SESSION_KEY);
  if (existingSession) {
    return existingSession;
  }

  const nextSession =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(SESSION_KEY, nextSession);
  return nextSession;
}

export function loadProgress(routeId, playMode = 'thematic') {
  return safeParse(localStorage.getItem(progressKey(routeId, playMode)), null);
}

export function saveProgress(routeId, playMode, progress) {
  localStorage.setItem(progressKey(routeId, playMode), JSON.stringify(progress));
  emitProgressUpdate();
}

export function resetProgress(routeId, playMode = 'thematic') {
  localStorage.removeItem(progressKey(routeId, playMode));
  emitProgressUpdate();
}

export function loadSettings() {
  return safeParse(localStorage.getItem(SETTINGS_KEY), {
    demoMode: true,
    playModeByRoute: {},
  });
}

export function saveSettings(nextSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  emitProgressUpdate();
}

export function getRoutePlayMode(routeId) {
  return loadSettings().playModeByRoute?.[routeId] || 'thematic';
}

export function saveRoutePlayMode(routeId, playMode) {
  const settings = loadSettings();
  saveSettings({
    ...settings,
    playModeByRoute: {
      ...(settings.playModeByRoute || {}),
      [routeId]: playMode,
    },
  });
}

export function toggleDemoMode() {
  const settings = loadSettings();
  saveSettings({
    ...settings,
    demoMode: !settings.demoMode,
  });
}

export function getMushroomBalance() {
  const highestByRoute = new Map();

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(`${PROGRESS_PREFIX}_`)) {
      continue;
    }

    const rawKey = key.slice(`${PROGRESS_PREFIX}_`.length);
    const routeId = rawKey.replace(/_(thematic|free)$/, '');
    const progress = safeParse(localStorage.getItem(key), null);
    const currentBest = highestByRoute.get(routeId) || 0;
    highestByRoute.set(routeId, Math.max(currentBest, progress?.mushrooms || 0));
  }

  return [...highestByRoute.values()].reduce((total, mushrooms) => total + mushrooms, 0);
}

export function subscribeToProfileUpdates(callback) {
  const emitBalance = () => callback(getMushroomBalance());

  window.addEventListener(PROFILE_EVENT, emitBalance);
  window.addEventListener('storage', emitBalance);

  return () => {
    window.removeEventListener(PROFILE_EVENT, emitBalance);
    window.removeEventListener('storage', emitBalance);
  };
}
