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
  approveUser,
  adminUpdateUserDetails,
  adminResetPassword,
} from '../controllers/userController.js';
import { broadcastNotification } from '../controllers/notificationController.js';

const router = express.Router();

// Current user routes
router.get('/me', verifyToken, getMyProfile);
router.patch('/me', verifyToken, updateMyProfile);

// Admin management routes
router.get('/', verifyToken, restrictTo('admin', 'superadmin'), getAllUsers);
router.post('/create', verifyToken, restrictTo('admin', 'superadmin'), adminCreateUser);
router.post('/broadcast', verifyToken, restrictTo('superadmin'), broadcastNotification);

// Specific ID-based actions
router.patch('/:userId/approve', verifyToken, restrictTo('admin', 'superadmin'), approveUser);
router.patch('/:userId/ban', verifyToken, restrictTo('admin', 'superadmin'), toggleBanUser);
router.patch('/:userId/role', verifyToken, restrictTo('admin', 'superadmin'), updateUserRole);
router.patch('/:userId/department', verifyToken, restrictTo('admin', 'superadmin'), assignDepartment);
router.get('/:userId/stats', verifyToken, restrictTo('admin', 'superadmin'), getUserStats);
router.patch('/:userId/details', verifyToken, restrictTo('admin', 'superadmin'), adminUpdateUserDetails);
router.patch('/:userId/reset-password', verifyToken, restrictTo('admin', 'superadmin'), adminResetPassword);
router.delete('/:userId', verifyToken, restrictTo('admin', 'superadmin'), deleteUser);

export default router;
