import { Router, type Router as RouterType} from 'express';
import authRouter from './auth.js';
import chatRouter from './chat.js';
import { requireAuth } from '../controllers/auth.js';
import * as reportController from '../controllers/report.js';

const router: RouterType = Router();

router.use('/v1/auth', authRouter);
router.use('/v1/chat', chatRouter);
router.get('/v1/generate-report', requireAuth, reportController.getReport);
router.post('/v1/generate-report', requireAuth, reportController.sendReport);

export default router;
