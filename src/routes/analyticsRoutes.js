import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { getSystemMetrics, getLeaderboard, getAnalyticsOverview } from '../controllers/analyticsController.js';

const router = express.Router();

// All analytics are restricted to QDM and Admins
router.use(verifyToken);
router.use(restrictTo('qdm', 'admin', 'superadmin'));

router.get('/metrics', getSystemMetrics);
router.get('/leaderboard', getLeaderboard);
router.get('/overview', getAnalyticsOverview);

export default router;
