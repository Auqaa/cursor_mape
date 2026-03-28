import { Router } from 'express';
import { buildNavigationRoute } from '../controllers/navigation.controller.js';

const router = Router();

router.post('/route', buildNavigationRoute);

export default router;
