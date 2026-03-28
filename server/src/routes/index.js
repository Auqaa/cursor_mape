import { Router } from 'express';
import routesRouter from './routes.routes.js';
import adminAuthRouter from './admin-auth.routes.js';
import adminRoutesRouter from './admin-routes.routes.js';
import discoveryRouter from './discovery.routes.js';
import navigationRouter from './navigation.routes.js';

const router = Router();

router.use('/routes', routesRouter);
router.use('/discovery', discoveryRouter);
router.use('/navigation', navigationRouter);
router.use('/admin/auth', adminAuthRouter);
router.use('/admin', adminRoutesRouter);

export default router;
