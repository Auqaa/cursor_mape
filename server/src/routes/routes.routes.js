import { Router } from 'express';
import {
  buildRoute,
  getRouteById,
  getRouteProgress,
  getRoutes,
  scanRoutePoint,
  submitPointQuiz,
} from '../controllers/routes.controller.js';

const router = Router();

router.get('/', getRoutes);
router.get('/:id', getRouteById);
router.post('/:id/build', buildRoute);
router.get('/:id/progress', getRouteProgress);
router.post('/:id/scan', scanRoutePoint);
router.post('/:id/quiz', submitPointQuiz);

export default router;
