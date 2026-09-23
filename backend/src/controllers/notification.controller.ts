import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import { currentUserId, getPagination, idParam, notFound, pageMeta } from '../lib/http.ts';

const select = { id: true, type: true, title: true, message: true, data: true, readAt: true, createdAt: true } as const;

/** NotificationList ("Notifications (N)") */
export const listNotifications = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { page, limit, skip, take } = getPagination(req);
  const [total, unreadCount, rows] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take, select })
  ]);
  res.status(200).json({
    message: 'Notifications fetched successfully.',
    code: 200,
    data: rows.map((n) => ({ ...n, isRead: Boolean(n.readAt) })),
    unreadCount,
    pagination: pageMeta(page, limit, total)
  });
};

/** Header bell badge. */
export const unreadNotificationCount = async (req: Request, res: Response) => {
  const count = await prisma.notification.count({ where: { userId: currentUserId(req), readAt: null } });
  res.status(200).json({ message: 'Unread count fetched successfully.', code: 200, data: { count } });
};

/** NotificationMessages (detail); opening it marks it read. */
export const getNotification = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = idParam(req);
  const notification = await prisma.notification.findFirst({ where: { id, userId }, select });
  if (!notification) throw notFound('Notification not found.');
  const readAt = notification.readAt ?? new Date();
  if (!notification.readAt) await prisma.notification.update({ where: { id }, data: { readAt } });
  res.status(200).json({
    message: 'Notification fetched successfully.',
    code: 200,
    data: { ...notification, readAt, isRead: true }
  });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: currentUserId(req), readAt: null },
    data: { readAt: new Date() }
  });
  res.status(200).json({ message: 'All notifications marked as read.', code: 200, data: { updated: count } });
};

export const deleteNotification = async (req: Request, res: Response) => {
  const { count } = await prisma.notification.deleteMany({ where: { id: idParam(req), userId: currentUserId(req) } });
  if (count === 0) throw notFound('Notification not found.');
  res.status(200).json({ message: 'Notification deleted.', code: 200 });
};
