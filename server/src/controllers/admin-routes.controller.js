import { Route } from '../models/route.model.js';
import { TransportInfo } from '../models/transport-info.model.js';
import { HttpError } from '../utils/http-error.js';

export async function createRoute(req, res, next) {
  try {
    const route = await Route.create(req.body);
    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
}

export async function updateRoute(req, res, next) {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }
    res.json(route);
  } catch (err) {
    next(err);
  }
}

export async function deleteRoute(req, res, next) {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }
    await TransportInfo.deleteMany({ routeId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function addRoutePoint(req, res, next) {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }
    route.points.push(req.body);
    await route.save();
    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
}

export async function updateRoutePoint(req, res, next) {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }
    const point = route.points.id(req.params.pointId);
    if (!point) {
      throw new HttpError(404, 'Point not found');
    }
    Object.assign(point, req.body);
    await route.save();
    res.json(route);
  } catch (err) {
    next(err);
  }
}

export async function deleteRoutePoint(req, res, next) {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      throw new HttpError(404, 'Route not found');
    }
    route.points = route.points.filter((p) => p._id.toString() !== req.params.pointId);
    await route.save();
    res.json(route);
  } catch (err) {
    next(err);
  }
}

export async function setTransportFallback(req, res, next) {
  try {
    const { routeId } = req.params;
    await TransportInfo.deleteMany({ routeId });
    const payload = (req.body.segments || []).map((segment) => ({
      routeId,
      fromPointOrder: segment.fromPointOrder,
      toPointOrder: segment.toPointOrder,
      routeNumber: segment.routeNumber,
      vehicleType: segment.vehicleType || 'bus',
      stops: (segment.stops || []).map((s) => (typeof s === 'string' ? s : s.name)),
      source: 'manual',
    }));
    const saved = await TransportInfo.insertMany(payload);
    res.json(saved);
  } catch (err) {
    next(err);
  }
}

