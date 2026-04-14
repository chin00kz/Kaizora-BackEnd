import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import {
  createKaizen,
  getKaizens,
  getKaizenById,
  updateKaizenStatus,
} from '../controllers/kaizenController.js';

const router = express.Router();

// Kaizen routes
router.get('/', verifyToken, getKaizens);
router.post('/', verifyToken, createKaizen);
router.get('/:kaizenId', verifyToken, getKaizenById);
router.patch('/:kaizenId/status', verifyToken, restrictTo('qdm', 'hod', 'admin', 'superadmin'), updateKaizenStatus);

export default router;
