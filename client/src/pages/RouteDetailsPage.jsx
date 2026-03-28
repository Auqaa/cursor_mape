import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import RouteMap from '../components/RouteMap';
import { api } from '../lib/api';
import { getDistanceMeters, getDistanceToPolylineMeters } from '../lib/geo';
import {
  getRoutePlayMode,
  getSessionId,
  loadProgress,
  loadSettings,
  saveProgress,
  saveRoutePlayMode,
  saveSettings,
} from '../lib/storage';

const TARGET_DISTANCE_METERS = 50;
const LOW_ACCURACY_THRESHOLD = 60;
const REROUTE_DISTANCE_METERS = 75;
const ROUTE_CACHE_PREFIX = 'ryazan_route_cache_v2';
const DISCOVERY_GROUPS = ['attractions', 'food', 'hotels', 'shops'];

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function routeCacheKey(routeId) {
  return `${ROUTE_CACHE_PREFIX}_${routeId}`;
}

function sortPoints(points = []) {
  return points
    .filter((point) => point?.coordinates && typeof point.order === 'number')
    .slice()
    .sort((left, right) => left.order - right.order);
}

function getCheckpointPoints(points = []) {
  return sortPoints(points).filter((point) => point.pointType !== 'waypoint');
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return 'нет данных';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} м`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} км`;
}

function formatAccuracy(accuracy) {
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    return 'нет данных';
  }

  return `±${Math.round(accuracy)} м`;
}

function getShareText(route, progress, completion) {
  if (completion?.shareText) {
    return completion.shareText;
  }

  return `Я исследую маршрут "${route?.title || 'Туристическая Рязань'}" и уже набрал ${progress?.mushrooms || 0} грибов.`;
}

function dedupePois(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.title}-${item.coordinates?.lat}-${item.coordinates?.lon}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function notifyMilestone(message) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  const show = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration?.showNotification) {
          await registration.showNotification('Туристическая Рязань', {
            body: message,
            tag: 'route-progress',
          });
          return true;
        }
      } catch {
        return false;
      }
    }

    new Notification('Туристическая Рязань', { body: message });
    return true;
  };

  if (Notification.permission === 'granted') {
    return show();
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return show();
    }
  }

  return false;
}

export default function RouteDetailsPage() {
  const { id } = useParams();
  const [route, setRoute] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [manualCodes, setManualCodes] = useState({});
  const [scanPointOrder, setScanPointOrder] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [visitModal, setVisitModal] = useState(null);
  const [position, setPosition] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [isOnline, setIsOnline] = useState(globalThis.navigator?.onLine ?? true);
  const [playMode, setPlayMode] = useState(() => getRoutePlayMode(id));
  const [demoMode, setDemoMode] = useState(() => loadSettings().demoMode ?? true);
  const [nearbyPois, setNearbyPois] = useState({});
  const [discoveryError, setDiscoveryError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [poiFilters, setPoiFilters] = useState(() => ({
    attractions: true,
    food: true,
    hotels: true,
    shops: true,
  }));
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [navigation, setNavigation] = useState(null);
  const [navigationError, setNavigationError] = useState('');
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [recenterTick, setRecenterTick] = useState(0);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const sessionId = useMemo(() => getSessionId(), []);
  const lastRerouteAtRef = useRef(0);
  const lastNavigationBuildRef = useRef({
    version: -1,
    destinationKey: '',
    origin: null,
  });
  const hasMapApiKey = Boolean(
    import.meta.env.VITE_2GIS_MAPGL_KEY && !import.meta.env.VITE_2GIS_MAPGL_KEY.startsWith('your-')
  );

  useEffect(() => {
    setPlayMode(getRoutePlayMode(id));
    setNotice('');
    setVisitModal(null);
    setShareFeedback('');
    setProgress(loadProgress(id, getRoutePlayMode(id)));
    setNavigation(null);
    setSearchResults([]);
    setSelectedTarget(null);
  }, [id]);

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);

    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
    };
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Ваш браузер не поддерживает геолокацию.');
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (nextPosition) => {
        setGeoError('');
        setPosition({
          lat: nextPosition.coords.latitude,
          lon: nextPosition.coords.longitude,
          accuracy: nextPosition.coords.accuracy,
        });
      },
      (nextError) => {
        if (nextError.code === nextError.PERMISSION_DENIED) {
          setGeoError('Включите геолокацию для продолжения.');
          return;
        }

        if (nextError.code === nextError.POSITION_UNAVAILABLE) {
          setGeoError('Не удалось определить позицию. Подойдите ближе к открытому пространству.');
          return;
        }

        setGeoError('Геолокация сейчас недоступна. Попробуйте еще раз.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cachedRoute = readCache(routeCacheKey(id));
    const cachedProgress = loadProgress(id, playMode);

    if (cachedRoute) {
      setRoute(cachedRoute);
    }

    if (cachedProgress) {
      setProgress(cachedProgress);
    }

    Promise.allSettled([api.getRouteById(id), api.getRouteProgress(id, sessionId, playMode)]).then(
      ([routeResult, progressResult]) => {
        if (cancelled) {
          return;
        }

        if (routeResult.status === 'fulfilled') {
          setRoute(routeResult.value);
          writeCache(routeCacheKey(id), routeResult.value);
          setError('');
        } else if (!cachedRoute) {
          setError(routeResult.reason.message);
        } else {
          setError('');
          setNotice('Открыт сохраненный маршрут из кэша.');
        }

        if (progressResult.status === 'fulfilled') {
          setProgress(progressResult.value.progress);
          saveProgress(id, playMode, progressResult.value.progress);
          setProgressError('');
        } else if (!cachedProgress) {
          setProgressError(progressResult.reason.message);
        } else {
          setProgressError('Используем локально сохраненный прогресс.');
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [id, playMode, sessionId]);

  const sortedPoints = useMemo(() => sortPoints(route?.points), [route]);
  const checkpointPoints = useMemo(() => getCheckpointPoints(route?.points), [route]);
  const completedPointOrders = useMemo(() => progress?.completedPointOrders || [], [progress]);
  const quizResultsByOrder = useMemo(
    () => new Map((progress?.quizResults || []).map((result) => [result.pointOrder, result])),
    [progress]
  );
  const remainingPoints = progress?.remainingPoints ?? checkpointPoints.length;
  const discoveryOrigin = position || sortedPoints[0]?.coordinates || null;

  const pointDistances = useMemo(() => {
    if (!position) {
      return {};
    }

    return Object.fromEntries(
      sortedPoints.map((point) => [point.order, getDistanceMeters(position, point.coordinates)])
    );
  }, [position, sortedPoints]);

  const nextPointOrder = progress?.nextPointOrder || null;
  const nearestUnvisitedCheckpoint = useMemo(() => {
    const candidates = checkpointPoints.filter((point) => !completedPointOrders.includes(point.order));
    if (!candidates.length) {
      return null;
    }

    if (!position) {
      return candidates[0];
    }

    return candidates
      .slice()
      .sort((left, right) => (pointDistances[left.order] || 0) - (pointDistances[right.order] || 0))[0];
  }, [checkpointPoints, completedPointOrders, pointDistances, position]);

  useEffect(() => {
    if (playMode !== 'free') {
      setSelectedTarget(null);
      return;
    }

    setSelectedTarget((current) => {
      if (current?.type === 'poi') {
        return current;
      }

      if (current?.type === 'point' && checkpointPoints.some((point) => point.order === current.order)) {
        return current;
      }

      return nearestUnvisitedCheckpoint ? { type: 'point', order: nearestUnvisitedCheckpoint.order } : null;
    });
  }, [checkpointPoints, nearestUnvisitedCheckpoint, playMode]);

  const filteredNearbyPois = useMemo(
    () =>
      dedupePois(
        DISCOVERY_GROUPS.filter((group) => poiFilters[group]).flatMap((group) => nearbyPois[group] || [])
      ),
    [nearbyPois, poiFilters]
  );

  const visiblePois = useMemo(() => dedupePois([...searchResults, ...filteredNearbyPois]), [filteredNearbyPois, searchResults]);
  const selectedPoi = useMemo(
    () => visiblePois.find((poi) => poi.id === selectedTarget?.id) || null,
    [selectedTarget?.id, visiblePois]
  );
  const selectedRoutePoint = useMemo(
    () => sortedPoints.find((point) => point.order === selectedTarget?.order) || null,
    [selectedTarget?.order, sortedPoints]
  );

  const currentPointOrder =
    playMode === 'thematic'
      ? nextPointOrder || null
      : selectedRoutePoint?.order || nearestUnvisitedCheckpoint?.order || null;
  const currentPoint = checkpointPoints.find((point) => point.order === currentPointOrder) || null;
  const currentDistance = currentPoint ? pointDistances[currentPoint.order] : null;

  const activeDestination = useMemo(() => {
    if (playMode === 'thematic') {
      return currentPoint
        ? {
            type: 'point',
            title: currentPoint.title,
            order: currentPoint.order,
            coordinates: currentPoint.coordinates,
          }
        : null;
    }

    if (selectedTarget?.type === 'poi' && selectedPoi) {
      return {
        type: 'poi',
        id: selectedPoi.id,
        title: selectedPoi.title,
        coordinates: selectedPoi.coordinates,
      };
    }

    if (selectedRoutePoint) {
      return {
        type: 'point',
        title: selectedRoutePoint.title,
        order: selectedRoutePoint.order,
        coordinates: selectedRoutePoint.coordinates,
      };
    }

    return null;
  }, [currentPoint, playMode, selectedPoi, selectedRoutePoint, selectedTarget]);
  const destinationKey = activeDestination
    ? `${activeDestination.type}:${activeDestination.id || activeDestination.order || activeDestination.title}`
    : 'none';

  useEffect(() => {
    if (!discoveryOrigin || !isOnline) {
      return;
    }

    let cancelled = false;

    api
      .getNearbyDiscovery({
        lat: discoveryOrigin.lat,
        lon: discoveryOrigin.lon,
        radius: 3200,
        groups: DISCOVERY_GROUPS,
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setNearbyPois(data.groups || {});
        setDiscoveryError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setDiscoveryError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [discoveryOrigin, isOnline]);

  const selectedRouteWaypoints = useMemo(() => {
    if (!activeDestination || activeDestination.type !== 'point') {
      return [];
    }

    return sortedPoints
      .filter((point) => point.pointType === 'waypoint' && point.order < activeDestination.order)
      .slice(-2)
      .map((point) => ({
        title: point.title,
        lat: point.coordinates.lat,
        lon: point.coordinates.lon,
      }));
  }, [activeDestination, sortedPoints]);

  useEffect(() => {
    if (!route || !discoveryOrigin || !activeDestination || !isOnline) {
      return;
    }

    const previousBuild = lastNavigationBuildRef.current;
    const movedEnough =
      !previousBuild.origin || getDistanceMeters(previousBuild.origin, discoveryOrigin) > 120;
    const shouldRebuild =
      navigationVersion !== previousBuild.version ||
      destinationKey !== previousBuild.destinationKey ||
      (!navigation && movedEnough);

    if (!shouldRebuild) {
      return;
    }

    lastNavigationBuildRef.current = {
      version: navigationVersion,
      destinationKey,
      origin: discoveryOrigin,
    };

    let cancelled = false;
    setNavigationLoading(true);

    api
      .buildNavigationRoute({
        origin: discoveryOrigin,
        destination: activeDestination.coordinates,
        waypoints: activeDestination.type === 'point' ? selectedRouteWaypoints : [],
        mode: playMode === 'thematic' ? 'thematic' : activeDestination.type === 'poi' ? 'free' : 'free',
        routeId: route._id,
        targetPointOrder: activeDestination.type === 'point' ? activeDestination.order : null,
        includeScenic: activeDestination.type === 'poi',
        maxScenicWaypoints: 3,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setNavigation(response);
        setNavigationError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setNavigationError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNavigationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeDestination,
    destinationKey,
    discoveryOrigin,
    isOnline,
    navigation,
    navigationVersion,
    playMode,
    route,
    selectedRouteWaypoints,
  ]);

  const offRouteDistance = useMemo(
    () => getDistanceToPolylineMeters(position, navigation?.geometry || []),
    [navigation?.geometry, position]
  );

  useEffect(() => {
    if (!position || !navigation?.geometry?.length || !activeDestination || !isOnline) {
      return;
    }

    if (offRouteDistance && offRouteDistance > REROUTE_DISTANCE_METERS) {
      const now = Date.now();
      if (now - lastRerouteAtRef.current > 8000) {
        lastRerouteAtRef.current = now;
        setNotice('Вы отклонились от маршрута. Перестраиваем путь по дорогам...');
        setNavigationVersion((current) => current + 1);
      }
    }
  }, [activeDestination, isOnline, navigation?.geometry, offRouteDistance, position]);

  const routeDistance = navigation?.summary?.distanceText || `${route?.distanceKm || 0} км`;
  const routeDuration = navigation?.summary?.durationText || `${route?.durationMinutes || 0} мин`;
  const routeSourceLabel =
    navigation?.source === '2gis'
      ? '2GIS Routing API'
      : navigation?.source === 'fallback'
        ? 'резервная линия по точкам'
        : hasMapApiKey
          ? '2GIS MapGL'
          : 'локальный режим';
  const lowAccuracy = position?.accuracy > LOW_ACCURACY_THRESHOLD;
  const routeCompleted = Boolean(progress?.routeCompleted);
  const modalPoint = checkpointPoints.find((point) => point.order === visitModal?.pointOrder) || null;
  const modalQuizResult = modalPoint ? quizResultsByOrder.get(modalPoint.order) || visitModal?.quizResult : null;
  const completion = visitModal?.completion;
  const modalQuestions = modalPoint?.questions || [];
  const hasModalQuiz = modalQuestions.length > 0;

  function syncProgress(nextProgress) {
    setProgress(nextProgress);
    saveProgress(id, playMode, nextProgress);
  }

  function updatePlayMode(nextPlayMode) {
    setPlayMode(nextPlayMode);
    saveRoutePlayMode(id, nextPlayMode);
    setVisitModal(null);
    setNotice('');
    setNavigationVersion((current) => current + 1);
  }

  function updateDemoMode() {
    const settings = loadSettings();
    const nextDemoMode = !demoMode;
    saveSettings({
      ...settings,
      demoMode: nextDemoMode,
    });
    setDemoMode(nextDemoMode);
    setNotice(
      nextDemoMode
        ? 'Включен демо-режим: можно пройти маршрут без физического QR-кода.'
        : 'Демо-режим отключен: для зачета нужен QR-код или ручной код под ним.'
    );
  }

  async function shareProgress() {
    if (!route) {
      return;
    }

    const shareText = getShareText(route, progress, completion);

    try {
      if (navigator.share) {
        await navigator.share({
          title: route.title,
          text: shareText,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        throw new Error('Шеринг в браузере недоступен');
      }

      setShareFeedback('Текст для шеринга готов.');
    } catch (err) {
      setShareFeedback(err.message);
    }
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();
    if (!searchQuery.trim() || !discoveryOrigin) {
      return;
    }

    setSearchLoading(true);
    setDiscoveryError('');

    try {
      const response = await api.searchDiscovery({
        query: searchQuery.trim(),
        lat: discoveryOrigin.lat,
        lon: discoveryOrigin.lon,
      });
      setSearchResults(response.items || []);
      if (response.items?.[0]) {
        setSelectedTarget({ type: 'poi', id: response.items[0].id });
      }
    } catch (err) {
      setDiscoveryError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleScan(point) {
    if (!route) {
      return;
    }

    if (!isOnline) {
      setNotice('Проверьте подключение к интернету. Кэшированный маршрут останется доступен.');
      return;
    }

    setScanPointOrder(point.order);
    setNotice('');
    setShareFeedback('');

    try {
      const response = await api.scanRoutePoint(id, {
        sessionId,
        pointOrder: point.order,
        playMode,
        demoMode,
        manualCode: manualCodes[point.order] || '',
      });

      if (response.progress) {
        syncProgress(response.progress);
      }
      setNotice(response.message);

      if (!response.accepted) {
        if (response.status === 'already-visited') {
          setVisitModal({
            pointOrder: point.order,
            visitAward: null,
            milestone: null,
            quizResult: quizResultsByOrder.get(point.order) || null,
            completion: null,
          });
        }
        return;
      }

      setManualCodes((current) => ({ ...current, [point.order]: '' }));
      setVisitModal({
        pointOrder: point.order,
        visitAward: response.visitAward,
        milestone: response.milestone,
        quizResult: null,
        completion: null,
      });
      setNavigationVersion((current) => current + 1);

      if (response.milestone?.halfWayReachedNow) {
        const message = `Осталось всего ${response.milestone.remainingPoints} точек до супер-приза!`;
        const shown = await notifyMilestone(message);
        if (!shown) {
          setNotice(message);
        }
      }
    } catch (err) {
      setNotice(err.message);
    } finally {
      setScanPointOrder(null);
    }
  }

  async function handleQuizSubmit() {
    if (!modalPoint || !route) {
      return;
    }

    setQuizSubmitting(true);
    setNotice('');

    try {
      const response = await api.submitPointQuiz(id, {
        sessionId,
        pointOrder: modalPoint.order,
        playMode,
        answers: visitModal?.answers || [],
      });

      syncProgress(response.progress);
      setVisitModal((current) =>
        current
          ? {
              ...current,
              quizResult: response.quizResult,
              completion: response.completion,
            }
          : current
      );
      setNotice(response.message);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setQuizSubmitting(false);
    }
  }

  function updateQuizAnswer(questionIndex, optionIndex) {
    setVisitModal((current) => {
      if (!current) {
        return current;
      }

      const nextAnswers = Array.isArray(current.answers)
        ? current.answers.slice()
        : new Array(modalPoint?.questions?.length || 0).fill(null);

      nextAnswers[questionIndex] = optionIndex;

      return {
        ...current,
        answers: nextAnswers,
      };
    });
  }

  function togglePoiFilter(group) {
    setPoiFilters((current) => ({
      ...current,
      [group]: !current[group],
    }));
  }

  function selectRoutePoint(point) {
    if (!point) {
      return;
    }

    setSelectedTarget({ type: 'point', order: point.order });
    setNotice(`Прокладываем путь к точке «${point.title}».`);
    setNavigationVersion((current) => current + 1);
  }

  function selectPoi(poi) {
    if (!poi) {
      return;
    }

    setSelectedTarget({ type: 'poi', id: poi.id });
    setNotice(`Прокладываем прогулочный путь к месту «${poi.title}».`);
    setNavigationVersion((current) => current + 1);
  }

  const isRouteLoading = !route && !error;

  return (
    <section className="route-page">
      {error && <p className="error">{error}</p>}
      {isRouteLoading && <p>Загрузка маршрута...</p>}
      {!isRouteLoading && route && (
        <>
          <div className="route-hero">
            <div>
              <p className="eyebrow">PWA-квест по Рязани на 2GIS</p>
              <h1>{route.title}</h1>
              <p>{route.description}</p>
            </div>

            <div className="route-hero__stats">
              <div className="metric">
                <span className="metric__label">Грибы</span>
                <strong>{progress?.mushrooms || 0} 🍄</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Checkpoint-ы</span>
                <strong>
                  {completedPointOrders.length}/{checkpointPoints.length}
                </strong>
              </div>
              <div className="metric">
                <span className="metric__label">Маршрут</span>
                <strong>{routeDistance}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Время</span>
                <strong>{routeDuration}</strong>
              </div>
            </div>
          </div>

          <div className="route-toolbar">
            <div className="toggle-group">
              <button
                className={playMode === 'thematic' ? 'btn active' : 'btn secondary'}
                onClick={() => updatePlayMode('thematic')}
                type="button"
              >
                Тематический маршрут
              </button>
              <button
                className={playMode === 'free' ? 'btn active' : 'btn secondary'}
                onClick={() => updatePlayMode('free')}
                type="button"
              >
                Свободная прогулка
              </button>
            </div>

            <div className="toggle-group">
              <button className={demoMode ? 'btn active' : 'btn secondary'} onClick={updateDemoMode} type="button">
                {demoMode ? 'Демо-режим включен' : 'Демо-режим выключен'}
              </button>
              <button className="btn secondary" onClick={() => setRecenterTick((current) => current + 1)} type="button">
                Следовать за мной
              </button>
            </div>
          </div>

          <div className="status-grid">
            <div className="status-card">
              <span className="status-card__label">Источник маршрута</span>
              <strong>{routeSourceLabel}</strong>
              {navigationLoading && <p className="status-note">Перестраиваем путь по дорогам...</p>}
              {navigationError && <p className="status-note">{navigationError}</p>}
            </div>
            <div className="status-card">
              <span className="status-card__label">Сеть</span>
              <strong>{isOnline ? 'онлайн' : 'офлайн'}</strong>
              {!isOnline && <p className="status-note">Кэшированные данные маршрута останутся доступны.</p>}
            </div>
            <div className="status-card">
              <span className="status-card__label">Геолокация</span>
              <strong>{geoError ? 'требует внимания' : 'активна'}</strong>
              {geoError && <p className="status-note">{geoError}</p>}
              {!geoError && <p>Точность: {formatAccuracy(position?.accuracy)}</p>}
            </div>
            <div className="status-card">
              <span className="status-card__label">Следующая цель</span>
              <strong>{activeDestination ? activeDestination.title : 'Маршрут завершен'}</strong>
              {currentPoint && <p>До checkpoint-а: {formatDistance(currentDistance)}</p>}
              {selectedPoi && <p>Путь к месту из 2GIS discovery.</p>}
            </div>
          </div>

          {lowAccuracy && (
            <p className="status-note">
              Низкая точность GPS. Подойдите ближе к открытому пространству и обновите позицию.
            </p>
          )}
          {offRouteDistance > REROUTE_DISTANCE_METERS && (
            <p className="status-note">Вы ушли от линии маршрута примерно на {formatDistance(offRouteDistance)}.</p>
          )}
          {progressError && <p className="status-note">{progressError}</p>}
          {discoveryError && <p className="status-note">{discoveryError}</p>}
          {notice && <p className="success-text">{notice}</p>}
          {shareFeedback && <p className="success-text">{shareFeedback}</p>}

          <RouteMap
            points={sortedPoints}
            navigationGeometry={navigation?.geometry || []}
            completedPointOrders={completedPointOrders}
            currentPointOrder={currentPointOrder}
            playMode={playMode}
            userPosition={position}
            pois={visiblePois}
            selectedPoiId={selectedPoi?.id || ''}
            onPointSelect={selectRoutePoint}
            onPoiSelect={selectPoi}
            recenterTick={recenterTick}
            mapStatus={navigation?.source || 'idle'}
          />

          <div className="map-legend">
            <span className="legend-chip legend-chip--done">Пройдено</span>
            <span className="legend-chip legend-chip--current">Текущая цель</span>
            <span className="legend-chip legend-chip--locked">
              {playMode === 'thematic' ? 'Еще не доступно' : 'Доступно свободно'}
            </span>
            <span className="legend-chip legend-chip--waypoint">Scenic waypoint</span>
          </div>

          <div className="poi-panel">
            <div className="poi-panel__header">
              <div>
                <h3>2GIS discovery</h3>
                <p>Живые места рядом: достопримечательности, еда, магазины и отели.</p>
              </div>
              <form className="poi-search" onSubmit={handleSearchSubmit}>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Найти место или адрес"
                />
                <button className="btn secondary" disabled={searchLoading || !searchQuery.trim()} type="submit">
                  {searchLoading ? 'Ищем...' : 'Искать'}
                </button>
              </form>
            </div>

            <div className="toggle-group">
              {DISCOVERY_GROUPS.map((group) => (
                <button
                  key={group}
                  className={poiFilters[group] ? 'btn active' : 'btn secondary'}
                  onClick={() => togglePoiFilter(group)}
                  type="button"
                >
                  {group === 'attractions'
                    ? 'Достопримечательности'
                    : group === 'food'
                      ? 'Еда'
                      : group === 'hotels'
                        ? 'Отели'
                        : 'Магазины'}
                </button>
              ))}
            </div>

            <div className="poi-list">
              {visiblePois.slice(0, 10).map((poi) => (
                <article key={poi.id} className={selectedPoi?.id === poi.id ? 'poi-card poi-card--selected' : 'poi-card'}>
                  <div>
                    <h4>{poi.title}</h4>
                    <p>{poi.address || poi.subtitle}</p>
                  </div>
                  <button className="btn secondary" onClick={() => selectPoi(poi)} type="button">
                    Вести сюда
                  </button>
                </article>
              ))}
              {!visiblePois.length && <p>Пока нет загруженных nearby POI. Дождитесь геолокации или попробуйте поиск.</p>}
            </div>
          </div>

          {routeCompleted && (
            <div className="success route-success">
              <h3>Маршрут завершен</h3>
              <p>
                Итоговый баланс: <strong>{progress?.mushrooms || 0} 🍄</strong>
              </p>
              {progress?.completionBonusAwarded > 0 && (
                <p>Финальный бонус тематического режима: +{progress.completionBonusAwarded} 🍄.</p>
              )}
              {progress?.promoCode && (
                <p>
                  Промокод для туристического центра: <strong>{progress.promoCode}</strong>
                </p>
              )}
              <button className="btn" onClick={shareProgress} type="button">
                Поделиться достижением
              </button>
            </div>
          )}

          <div className="points">
            <div className="points__header">
              <div>
                <h3>Точки маршрута</h3>
                <p>
                  Осталось checkpoint-ов: {remainingPoints}. Радиус активации сканера: {TARGET_DISTANCE_METERS} м.
                </p>
              </div>
            </div>

            {sortedPoints.map((point) => {
              const isCheckpoint = point.pointType !== 'waypoint';
              const isCompleted = completedPointOrders.includes(point.order);
              const isCurrent = point.order === currentPointOrder;
              const quizResult = quizResultsByOrder.get(point.order) || null;
              const distanceToPoint = pointDistances[point.order];
              const isNearPoint = Number.isFinite(distanceToPoint) && distanceToPoint <= TARGET_DISTANCE_METERS;
              const isUnlocked = playMode === 'free' || isCurrent;
              const canScan = !routeCompleted && isCheckpoint && !isCompleted && isUnlocked && (demoMode || isNearPoint);
              const needsCode = !demoMode && !isCompleted && isUnlocked && isCheckpoint;
              const pointStatus = isCompleted
                ? 'done'
                : isCheckpoint
                  ? isCurrent
                    ? 'current'
                    : playMode === 'thematic'
                      ? 'locked'
                      : 'pending'
                  : 'waypoint';

              return (
                <article key={point._id || point.order} className={`point point--${pointStatus}`}>
                  <div className="point__header">
                    <div>
                      <h4>
                        {point.order}. {point.title}
                      </h4>
                      <p>{point.description}</p>
                    </div>
                    <span className={`badge badge--${pointStatus}`}>
                      {isCheckpoint
                        ? isCompleted
                          ? 'Пройдена'
                          : isCurrent
                            ? 'Сейчас'
                            : playMode === 'thematic'
                              ? 'Заблокирована'
                              : 'Доступна'
                        : 'Waypoint'}
                    </span>
                  </div>

                  <div className="point__meta">
                    <span>Расстояние: {formatDistance(distanceToPoint)}</span>
                    <span>{isCheckpoint ? `Квиз: ${quizResult ? `${quizResult.correctCount}/${quizResult.totalQuestions}` : 'не пройден'}` : 'Навигационная точка'}</span>
                    <span>{isCheckpoint ? 'Награда за посещение: 10 🍄' : 'Помогает вести по красивому пути'}</span>
                  </div>

                  {!isCheckpoint && (
                    <div className="point__actions">
                      <button className="btn secondary" onClick={() => selectRoutePoint(point)} type="button">
                        Вести сюда
                      </button>
                    </div>
                  )}

                  {isCheckpoint && isCompleted && (
                    <div className="point__actions">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setVisitModal({
                            pointOrder: point.order,
                            visitAward: null,
                            milestone: null,
                            quizResult,
                            completion: null,
                          })
                        }
                        type="button"
                      >
                        Открыть факт и результат
                      </button>
                    </div>
                  )}

                  {isCheckpoint && !isCompleted && (
                    <div className="point__actions">
                      {needsCode && (
                        <input
                          value={manualCodes[point.order] || ''}
                          onChange={(event) =>
                            setManualCodes((current) => ({
                              ...current,
                              [point.order]: event.target.value,
                            }))
                          }
                          placeholder="Введите цифровой код под QR"
                        />
                      )}

                      <button
                        className="btn"
                        disabled={scanPointOrder === point.order || !canScan || (!demoMode && !(manualCodes[point.order] || '').trim())}
                        onClick={() => handleScan(point)}
                        type="button"
                      >
                        {scanPointOrder === point.order
                          ? 'Проверяем точку...'
                          : demoMode
                            ? 'Фейковый сканер'
                            : 'Подтвердить код точки'}
                      </button>

                      {playMode === 'free' && (
                        <button className="btn secondary" onClick={() => selectRoutePoint(point)} type="button">
                          Вести сюда
                        </button>
                      )}

                      {!demoMode && !isNearPoint && isUnlocked && (
                        <p className="status-note">
                          Сканер активируется при приближении к точке на {TARGET_DISTANCE_METERS} м. Сейчас: {formatDistance(distanceToPoint)}.
                        </p>
                      )}
                      {!demoMode && !position && isUnlocked && !geoError && (
                        <p className="status-note">Ожидаем GPS-координаты, чтобы активировать сканер.</p>
                      )}
                      {playMode === 'thematic' && !isUnlocked && (
                        <p className="status-note">Сначала пройдите предыдущую контрольную точку маршрута.</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {visitModal && modalPoint && (
            <div className="modal-backdrop" role="presentation">
              <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="point-modal-title">
                <div className="modal-card__header">
                  <div>
                    <p className="eyebrow">Контрольная точка</p>
                    <h3 id="point-modal-title">
                      {modalPoint.order}. {modalPoint.title}
                    </h3>
                  </div>
                  <button className="btn secondary" onClick={() => setVisitModal(null)} type="button">
                    Закрыть
                  </button>
                </div>

                {visitModal.visitAward && (
                  <div className="reward-banner">
                    <strong>+{visitModal.visitAward.mushrooms} 🍄 за посещение</strong>
                    <p>{visitModal.visitAward.fact}</p>
                  </div>
                )}

                {!visitModal.visitAward && <p>{modalPoint.description}</p>}

                <div className="quiz-card">
                  <div className="quiz-card__header">
                    <div>
                      <h4>{hasModalQuiz ? 'Квиз по точке' : 'Исторический факт'}</h4>
                      <p>
                        {hasModalQuiz
                          ? `Вопросов: ${modalQuestions.length}. Бонус за идеальное прохождение: +15 🍄.`
                          : 'На этой точке нет отдельного квиза, но факт и прогресс сохраняются.'}
                      </p>
                    </div>
                    <button className="btn secondary" onClick={shareProgress} type="button">
                      Поделиться
                    </button>
                  </div>

                  {modalQuestions.map((question, questionIndex) => (
                    <fieldset key={`${modalPoint.order}-${question.id}`} className="quiz-question">
                      <legend>{question.prompt}</legend>
                      <div className="quiz-options">
                        {question.options.map((option, optionIndex) => (
                          <label key={`${question.id}-${optionIndex}`} className="quiz-option">
                            <input
                              checked={visitModal.answers?.[questionIndex] === optionIndex}
                              disabled={Boolean(modalQuizResult)}
                              name={`question-${modalPoint.order}-${question.id}`}
                              onChange={() => updateQuizAnswer(questionIndex, optionIndex)}
                              type="radio"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                      {modalQuizResult && question.explanation && (
                        <p className="quiz-explanation">{question.explanation}</p>
                      )}
                    </fieldset>
                  ))}

                  {!modalQuizResult && (
                    <button className="btn" disabled={quizSubmitting} onClick={handleQuizSubmit} type="button">
                      {quizSubmitting
                        ? hasModalQuiz
                          ? 'Сохраняем квиз...'
                          : 'Сохраняем точку...'
                        : hasModalQuiz
                          ? 'Завершить квиз'
                          : 'Подтвердить факт'}
                    </button>
                  )}

                  {modalQuizResult && (
                    <div className="success quiz-result">
                      <p>
                        Верных ответов: <strong>{modalQuizResult.correctCount}</strong> из{' '}
                        <strong>{modalQuizResult.totalQuestions}</strong>
                      </p>
                      <p>
                        Начислено за квиз: <strong>+{modalQuizResult.awardedMushrooms} 🍄</strong>
                      </p>
                      {modalQuizResult.perfect && <p>Идеальное прохождение: бонус засчитан полностью.</p>}
                    </div>
                  )}
                </div>

                {completion && (
                  <div className="success completion-card">
                    <h4>Финал маршрута</h4>
                    <p>
                      Промокод: <strong>{completion.promoCode}</strong>
                    </p>
                    {completion.completionBonus > 0 && <p>Финальный x2-бонус: +{completion.completionBonus} 🍄.</p>}
                    <button className="btn" onClick={shareProgress} type="button">
                      Поделиться результатом
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
