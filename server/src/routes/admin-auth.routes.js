import { Router } from 'express';
import { adminLogin, adminLogout, adminRefresh } from '../controllers/admin-auth.controller.js';

const router = Router();

router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);
router.post('/logout', adminLogout);

export default router;

