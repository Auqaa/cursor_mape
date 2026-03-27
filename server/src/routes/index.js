import { Router } from 'express';
import routesRouter from './routes.routes.js';
import adminAuthRouter from './admin-auth.routes.js';
import adminRoutesRouter from './admin-routes.routes.js';

const router = Router();

router.use('/routes', routesRouter);
router.use('/admin/auth', adminAuthRouter);
router.use('/admin', adminRoutesRouter);

export default router;

