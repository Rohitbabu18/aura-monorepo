import { prisma } from '../lib/prisma.ts';

type NotificationType =
  | 'APPOINTMENT'
  | 'HOSPITAL_BOOKING'
  | 'PAYMENT'
  | 'REPORT'
  | 'CHAT'
  | 'FEED'
  | 'ASSISTANT'
  | 'SYSTEM';

/** Stores an in-app notification (NotificationList screen). Push delivery can hook in here later. */
export const notify = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
) => {
  await prisma.notification.create({
    data: { userId, type, title, message, data: data as object | undefined }
  });
};
