import { Router } from 'express';
import { buildRoute, getRouteById, getRoutes } from '../controllers/routes.controller.js';

const router = Router();

router.get('/', getRoutes);
router.get('/:id', getRouteById);
router.post('/:id/build', buildRoute);

export default router;

