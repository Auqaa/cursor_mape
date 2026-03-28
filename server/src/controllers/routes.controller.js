import crypto from 'node:crypto';
import { Route } from '../models/route.model.js';
import { RouteProgress } from '../models/route-progress.model.js';
import { HttpError } from '../utils/http-error.js';
import { buildRoutePath } from '../services/route-builder.service.js';

const PLAY_MODES = new Set(['thematic', 'free']);
const VISIT_MUSHROOMS = 10;
const PERFECT_QUIZ_BONUS = 15;
const SINGLE_ANSWER_BONUS = 2;

function normalizePlayMode(value) {
  return PLAY_MODES.has(value) ? value : 'thematic';
}

function sanitizePoints(points = []) {
  return points
    .filter((point) => point && point.coordinates && typeof point.order === 'number')
    .sort((a, b) => a.order - b.order);
}

function sanitizeCheckpointPoints(points = []) {
  return sanitizePoints(points).filter((point) => point.pointType !== 'waypoint');
}

function serializeQuestions(questions = []) {
  return questions.map((question, index) => ({
    id: index + 1,
    prompt: question.prompt,
    options: question.options || [],
    explanation: question.explanation || '',
  }));
}

function serializePoint(point) {
  const plainPoint = point.toObject ? point.toObject() : point;

  return {
    _id: plainPoint._id,
    title: plainPoint.title,
    description: plainPoint.description,
    coordinates: plainPoint.coordinates,
    order: plainPoint.order,
    pointType: plainPoint.pointType || 'checkpoint',
    source: plainPoint.source || 'curated',
    externalId: plainPoint.externalId || '',
    questions: serializeQuestions(plainPoint.questions || []),
  };
}

function serializeRoute(route) {
  const plainRoute = route.toObject ? route.toObject() : route;

  return {
    ...plainRoute,
    points: sanitizePoints(plainRoute.points).map(serializePoint),
  };
}

function serializeProgress(route, progress) {
  const points = sanitizeCheckpointPoints(route.points);
  const completedPointOrders = progress.visitedPoints
    .map((item) => item.pointOrder)
    .sort((a, b) => a - b);
  const totalPoints = points.length;
  const remainingPoints = Math.max(totalPoints - completedPointOrders.length, 0);
  const nextPointOrder =
    progress.playMode === 'thematic'
      ? points.find((point) => !completedPointOrders.includes(point.order))?.order || null
      : null;

  return {
    sessionId: progress.sessionId,
    playMode: progress.playMode,
    mushrooms: progress.mushrooms,
    completedPointOrders,
    visitedPoints: progress.visitedPoints,
    quizResults: progress.quizResults,
    totalPoints,
    remainingPoints,
    nextPointOrder,
    routeCompleted: Boolean(progress.completedAt),
    completionBonusAwarded: progress.completionBonusAwarded,
    promoCode: progress.promoCode,
    halfWayNotified: progress.halfWayNotified,
    completedAt: progress.completedAt,
  };
}

function getSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || req.headers['x-session-id'] || '').trim();
}

function createPromoCode() {
  return `RYAZAN-${crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase()}`;
}

async function getRouteOrThrow(routeId) {
  const route = await Route.findById(routeId);
  if (!route) {
    throw new HttpError(404, 'Route not found');
  }

  return route;
}

async function getOrCreateProgress(routeId, sessionId, playMode) {
  return RouteProgress.findOneAndUpdate(
    { routeId, sessionId, playMode },
    { $setOnInsert: { routeId, sessionId, playMode } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

function getPointByOrder(route, pointOrder) {
  return sanitizePoints(route.points).find((point) => point.order === pointOrder) || null;
}

function getNextPoint(route, completedPointOrders) {
  return sanitizeCheckpointPoints(route.points).find((point) => !completedPointOrders.includes(point.order)) || null;
}

function computeQuizReward(point, answers) {
  const questions = point.questions || [];
  const normalizedAnswers = Array.isArray(answers) ? answers : [];
  let correctCount = 0;

  for (const [index, question] of questions.entries()) {
    if (Number(normalizedAnswers[index]) === question.correctOption) {
      correctCount += 1;
    }
  }

  const perfect = questions.length > 0 && correctCount === questions.length;
  const awardedMushrooms = perfect ? PERFECT_QUIZ_BONUS : correctCount * SINGLE_ANSWER_BONUS;

  return {
    correctCount,
    totalQuestions: questions.length,
    perfect,
    awardedMushrooms,
  };
}

function ensureSessionId(sessionId) {
  if (!sessionId) {
    throw new HttpError(400, 'Session ID is required');
  }
}

export async function getRoutes(_req, res, next) {
  try {
    const routes = await Route.find({}, 'title description distanceKm durationMinutes city points').sort({
      createdAt: -1,
    });
    res.json(
      routes.map((route) => {
        const checkpoints = sanitizeCheckpointPoints(route.points);
        return {
          _id: route._id,
          title: route.title,
          description: route.description,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
          city: route.city,
          pointCount: sanitizePoints(route.points).length,
          checkpointCount: checkpoints.length,
        };
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function getRouteById(req, res, next) {
  try {
    const route = await getRouteOrThrow(req.params.id);
    res.json(serializeRoute(route));
  } catch (err) {
    next(err);
  }
}

export async function buildRoute(req, res, next) {
  try {
    const route = await getRouteOrThrow(req.params.id);
    const built = await buildRoutePath(route);

    res.json({
      routeId: route._id,
      mode: 'walking',
      source: built.source || 'fallback',
      points: sanitizePoints(route.points).map(serializePoint),
      coordinates: built.coordinates,
      summary: built.summary,
    });
  } catch (err) {
    if (err.message?.includes('supports up to')) {
      next(new HttpError(400, err.message));
      return;
    }

    next(err);
  }
}

export async function getRouteProgress(req, res, next) {
  try {
    const sessionId = getSessionId(req);
    ensureSessionId(sessionId);

    const playMode = normalizePlayMode(req.query.playMode);
    const route = await getRouteOrThrow(req.params.id);
    const progress = await getOrCreateProgress(route._id, sessionId, playMode);

    res.json({
      routeId: route._id,
      progress: serializeProgress(route, progress),
    });
  } catch (err) {
    next(err);
  }
}

export async function scanRoutePoint(req, res, next) {
  try {
    const sessionId = getSessionId(req);
    ensureSessionId(sessionId);

    const pointOrder = Number(req.body.pointOrder);
    if (!Number.isFinite(pointOrder)) {
      throw new HttpError(400, 'Point order is required');
    }

    const playMode = normalizePlayMode(req.body.playMode);
    const route = await getRouteOrThrow(req.params.id);
    const point = getPointByOrder(route, pointOrder);
    if (!point) {
      throw new HttpError(404, 'Point not found');
    }

    if (point.pointType === 'waypoint') {
      res.json({
        accepted: false,
        status: 'not-interactive',
        message: 'Эта точка ведет по маршруту, но интерактив доступен только на контрольных точках.',
        point: serializePoint(point),
      });
      return;
    }

    const progress = await getOrCreateProgress(route._id, sessionId, playMode);
    const completedPointOrders = progress.visitedPoints.map((item) => item.pointOrder);

    if (completedPointOrders.includes(pointOrder)) {
      res.json({
        accepted: false,
        status: 'already-visited',
        message: 'Вы уже посетили эту точку!',
        point: serializePoint(point),
        progress: serializeProgress(route, progress),
      });
      return;
    }

    if (playMode === 'thematic') {
      const nextPoint = getNextPoint(route, completedPointOrders);
      if (nextPoint && nextPoint.order !== pointOrder) {
        res.json({
          accepted: false,
          status: 'wrong-point',
          message: 'Эта точка не является следующей на вашем маршруте.',
          point: serializePoint(point),
          progress: serializeProgress(route, progress),
        });
        return;
      }
    }

    const providedCode = String(req.body.manualCode || req.body.qrCode || '').trim();
    const isDemoMode = Boolean(req.body.demoMode);
    const allowedCodes = [point.qrCode, point.manualCode].filter(Boolean);

    if (!isDemoMode && (!providedCode || !allowedCodes.includes(providedCode))) {
      res.json({
        accepted: false,
        status: 'invalid-code',
        message: 'Код точки не распознан. Проверьте QR или введите код вручную.',
        point: serializePoint(point),
        progress: serializeProgress(route, progress),
      });
      return;
    }

    progress.visitedPoints.push({
      pointOrder,
      awardedMushrooms: VISIT_MUSHROOMS,
      demoMode: isDemoMode,
      scannedAt: new Date(),
    });
    progress.mushrooms += VISIT_MUSHROOMS;

    const completedAfterScan = progress.visitedPoints.length;
    const totalCheckpoints = sanitizeCheckpointPoints(route.points).length;
    const halfWayThreshold = Math.ceil(totalCheckpoints / 2);
    const halfWayReachedNow =
      !progress.halfWayNotified &&
      completedAfterScan >= halfWayThreshold &&
      completedAfterScan < totalCheckpoints;

    if (halfWayReachedNow) {
      progress.halfWayNotified = true;
    }

    await progress.save();

    res.json({
      accepted: true,
      status: 'accepted',
      message: 'Точка засчитана! Исторический факт открыт.',
      visitAward: {
        mushrooms: VISIT_MUSHROOMS,
        fact: point.description,
      },
      point: serializePoint(point),
      progress: serializeProgress(route, progress),
      milestone: {
        halfWayReachedNow,
        remainingPoints: Math.max(totalCheckpoints - completedAfterScan, 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function submitPointQuiz(req, res, next) {
  try {
    const sessionId = getSessionId(req);
    ensureSessionId(sessionId);

    const pointOrder = Number(req.body.pointOrder);
    if (!Number.isFinite(pointOrder)) {
      throw new HttpError(400, 'Point order is required');
    }

    const playMode = normalizePlayMode(req.body.playMode);
    const route = await getRouteOrThrow(req.params.id);
    const point = getPointByOrder(route, pointOrder);
    if (!point) {
      throw new HttpError(404, 'Point not found');
    }

    const progress = await getOrCreateProgress(route._id, sessionId, playMode);

    if (point.pointType === 'waypoint') {
      res.json({
        accepted: false,
        status: 'not-interactive',
        message: 'На waypoint нет отдельного квиза.',
        progress: serializeProgress(route, progress),
      });
      return;
    }
    if (!progress.visitedPoints.some((item) => item.pointOrder === pointOrder)) {
      res.json({
        accepted: false,
        status: 'point-not-visited',
        message: 'Сначала посетите точку, потом проходите квиз.',
        progress: serializeProgress(route, progress),
      });
      return;
    }

    if (progress.quizResults.some((item) => item.pointOrder === pointOrder)) {
      res.json({
        accepted: false,
        status: 'quiz-already-completed',
        message: 'Квиз для этой точки уже пройден.',
        progress: serializeProgress(route, progress),
      });
      return;
    }

    const questions = point.questions || [];
    const quizResult = computeQuizReward(point, req.body.answers);
    progress.quizResults.push({
      pointOrder,
      correctCount: quizResult.correctCount,
      totalQuestions: quizResult.totalQuestions,
      awardedMushrooms: quizResult.awardedMushrooms,
      perfect: quizResult.perfect,
      answeredAt: new Date(),
    });
    progress.mushrooms += quizResult.awardedMushrooms;

    let completion = null;
    const totalPoints = sanitizeCheckpointPoints(route.points).length;
    if (progress.visitedPoints.length >= totalPoints && !progress.completedAt) {
      progress.completedAt = new Date();

      let completionBonus = 0;
      if (progress.playMode === 'thematic') {
        completionBonus = progress.mushrooms;
        progress.mushrooms += completionBonus;
        progress.completionBonusAwarded = completionBonus;
      }

      if (!progress.promoCode) {
        progress.promoCode = createPromoCode();
      }

      completion = {
        routeCompleted: true,
        completionBonus,
        promoCode: progress.promoCode,
        shareText: `Я прошел маршрут "${route.title}" и набрал ${progress.mushrooms} грибов в Туристической Рязани!`,
      };
    }

    await progress.save();

    res.json({
      accepted: true,
      status: 'quiz-completed',
      message: questions.length > 0 ? 'Квиз засчитан.' : 'Исторический факт открыт без квиза.',
      quizResult,
      completion,
      progress: serializeProgress(route, progress),
    });
  } catch (err) {
    next(err);
  }
}
