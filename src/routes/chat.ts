import { Router, type Router as RouterType} from 'express';
import {requireAuth} from '../controllers/auth.js';
import * as ChatController from '../controllers/chat.js';

const router: RouterType = Router();

router.get('/chats', requireAuth, ChatController.getChats);
router.post('/chats', requireAuth, ChatController.insertChat);
router.delete('/chats', requireAuth, ChatController.deleteChat);
router.get('/messages', requireAuth, ChatController.getChatMessages);
router.post('/messages', requireAuth, ChatController.insertChatMessage);
router.post('/chats/summary', requireAuth, ChatController.generateChatSummary);

export default router;