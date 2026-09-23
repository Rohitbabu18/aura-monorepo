import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  sendMessage,
  setConversationBlocked
} from '../controllers/chat.controller.ts';

const router = Router();

router.use(requireAuth);

router.get('/', listConversations);
router.post('/', openConversation);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', sendMessage);
router.post('/:id/read', markConversationRead);
router.post('/:id/block', setConversationBlocked);

export default router;
