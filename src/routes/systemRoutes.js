import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import { 
  getSystemStatus, 
  updateSystemSettings, 
  purgeRejectedKaizens,
  getSystemLogs,
  clearSystemLogs
} from '../controllers/systemController.js';

const router = express.Router();

// Public status check
router.get('/status', getSystemStatus);

// Management (Protected)
router.patch('/settings', verifyToken, restrictTo('admin', 'superadmin'), updateSystemSettings);
router.get('/logs', verifyToken, restrictTo('superadmin'), getSystemLogs);
router.delete('/logs', verifyToken, restrictTo('superadmin'), clearSystemLogs);
router.delete('/nuclear/purge-rejected', verifyToken, restrictTo('superadmin'), purgeRejectedKaizens);

export default router;
