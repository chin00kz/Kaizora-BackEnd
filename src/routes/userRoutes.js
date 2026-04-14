import express from 'express';
import * as userController from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// All user routes are protected
router.use(verifyToken);

router.get('/me', userController.getMyProfile);
router.patch('/update-me', userController.updateMyProfile);

export default router;
