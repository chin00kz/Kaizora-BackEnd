import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { 
  getSystemStatus, 
  updateSystemSettings, 
  updateBannerSettings,
  purgeRejectedKaizens,
  getSystemLogs,
  clearSystemLogs
} from '../controllers/systemController.js';
import { getAboutContent, updateCreatorProfile } from '../controllers/aboutController.js';

const router = express.Router();

// Public status check
router.get('/status', getSystemStatus);

// Management (Protected)
router.patch('/settings', verifyToken, restrictTo('admin', 'superadmin'), updateSystemSettings);
router.patch('/banner', verifyToken, restrictTo('qdm', 'admin', 'superadmin'), updateBannerSettings);
router.get('/logs', verifyToken, restrictTo('superadmin'), getSystemLogs);
router.delete('/logs', verifyToken, restrictTo('superadmin'), clearSystemLogs);
router.delete('/nuclear/purge-rejected', verifyToken, restrictTo('superadmin'), purgeRejectedKaizens);

// About Page Endpoints
router.get('/about', getAboutContent);
router.patch('/creators/profile', verifyToken, updateCreatorProfile);

export default router;
