import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../controllers/auth.js';
import * as adminUserController from '../controllers/adminUser.js';
import { type Request, type Response, type NextFunction } from 'express';

const router: RouterType = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  next();
}

router.get('/users', requireAuth, requireAdmin, adminUserController.getUsers);
router.post('/users', requireAuth, requireAdmin, adminUserController.createUser);
router.delete('/users/:id', requireAuth, requireAdmin, adminUserController.deleteUser);

export default router;
