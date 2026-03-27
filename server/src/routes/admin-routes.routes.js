import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  addRoutePoint,
  createRoute,
  deleteRoute,
  deleteRoutePoint,
  setTransportFallback,
  updateRoute,
  updateRoutePoint,
} from '../controllers/admin-routes.controller.js';

const router = Router();

router.use(requireAdmin);
router.post('/routes', createRoute);
router.patch('/routes/:id', updateRoute);
router.delete('/routes/:id', deleteRoute);

router.post('/routes/:routeId/points', addRoutePoint);
router.patch('/routes/:routeId/points/:pointId', updateRoutePoint);
router.delete('/routes/:routeId/points/:pointId', deleteRoutePoint);

router.put('/routes/:routeId/transport-fallback', setTransportFallback);

export default router;

