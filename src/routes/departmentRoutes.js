import express from 'express';
import { verifyToken, restrictTo } from '../middleware/auth.js';
import {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';

const router = express.Router();

// Department routes
router.get('/', verifyToken, getAllDepartments);
router.post('/', verifyToken, restrictTo('admin', 'superadmin'), createDepartment);
router.patch('/:id', verifyToken, restrictTo('admin', 'superadmin'), updateDepartment);
router.delete('/:id', verifyToken, restrictTo('admin', 'superadmin'), deleteDepartment);

export default router;
