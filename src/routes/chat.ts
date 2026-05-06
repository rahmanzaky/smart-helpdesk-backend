import { Router, type Router as RouterType} from 'express';
import {requireAuth} from '../controllers/auth.js';
import * as ChatController from '../controllers/chat.js';

const router: RouterType = Router();

router.get('/chats', requireAuth, ChatController.getChats);
router.post('/chats', requireAuth, ChatController.insertChat);
router.get('/messages', requireAuth, ChatController.getChatMessages);
router.post('/messages', requireAuth, ChatController.insertChatMessage);

export default router;