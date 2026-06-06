import { Router, type Router as RouterType} from 'express';
import * as authController from '../controllers/auth.js';

const router: RouterType = Router();

router.post('/register', authController.register);
router.post('/verify', authController.verify);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authController.requireAuth, authController.me);
router.post('/change-password', authController.requireAuth, authController.changePassword);

export default router;