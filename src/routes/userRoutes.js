import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  adminCreateUser,
  updateUserRole,
  assignDepartment,
  getUserStats,
  toggleBanUser,
  deleteUser,
} from '../controllers/userController.js';

const router = express.Router();

// Current user routes
router.get('/me', verifyToken, getMyProfile);
router.patch('/me', verifyToken, updateMyProfile);

// Admin management routes
router.get('/', verifyToken, restrictTo('admin', 'superadmin'), getAllUsers);
router.post('/create', verifyToken, restrictTo('admin', 'superadmin'), adminCreateUser);
router.patch('/:userId/role', verifyToken, restrictTo('admin', 'superadmin'), updateUserRole);
router.patch('/:userId/department', verifyToken, restrictTo('admin', 'superadmin'), assignDepartment);
router.get('/:userId/stats', verifyToken, restrictTo('admin', 'superadmin'), getUserStats);
router.patch('/:userId/ban', verifyToken, restrictTo('admin', 'superadmin'), toggleBanUser);
router.delete('/:userId', verifyToken, restrictTo('superadmin'), deleteUser);

export default router;
