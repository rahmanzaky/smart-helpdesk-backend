import { Router, type Router as RouterType} from 'express';
import authRouter from './auth.js';
import chatRouter from './chat.js';
import * as reportController from '../controllers/report.js'

const router: RouterType = Router();

router.use('/v1/auth', authRouter);
router.use('/v1/chat', chatRouter);
router.use('/v1/generate-report', reportController.createReport)

export default router;