import { Router } from 'express';
import { getNearbyDiscovery, searchDiscovery } from '../controllers/discovery.controller.js';

const router = Router();

router.get('/nearby', getNearbyDiscovery);
router.get('/search', searchDiscovery);

export default router;
