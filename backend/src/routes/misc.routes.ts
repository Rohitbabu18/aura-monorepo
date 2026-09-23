import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { listPayments } from '../controllers/payment.controller.ts';
import {
  deleteNotification,
  getNotification,
  listNotifications,
  markAllNotificationsRead,
  unreadNotificationCount
} from '../controllers/notification.controller.ts';

export const paymentRouter = Router();
paymentRouter.use(requireAuth);
paymentRouter.get('/', listPayments);

export const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get('/', listNotifications);
notificationRouter.get('/unread-count', unreadNotificationCount);
notificationRouter.post('/read-all', markAllNotificationsRead);
notificationRouter.get('/:id', getNotification);
notificationRouter.delete('/:id', deleteNotification);
