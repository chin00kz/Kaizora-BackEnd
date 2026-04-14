import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import {
  createKaizen,
  getKaizens,
  getMyKaizens,
  getKaizenById,
  updateKaizenStatus,
  evaluateKaizen,
  addComment
} from '../controllers/kaizenController.js';

const router = express.Router();

// Kaizen routes
router.get('/', verifyToken, getKaizens);
router.get('/me', verifyToken, getMyKaizens);
router.post('/', verifyToken, createKaizen);

// Single Kaizen operations
router.get('/:kaizenId', verifyToken, getKaizenById);
router.patch('/:kaizenId/status', verifyToken, restrictTo('qdm', 'hod', 'admin', 'superadmin'), updateKaizenStatus);
router.patch('/:kaizenId/evaluate', verifyToken, restrictTo('qdm', 'hod', 'admin', 'superadmin'), evaluateKaizen);
router.post('/:kaizenId/comments', verifyToken, addComment);

export default router;
