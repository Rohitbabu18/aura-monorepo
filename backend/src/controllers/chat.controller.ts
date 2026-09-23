import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.ts';
import { badRequest, currentUserId, forbidden, getPagination, idParam, notFound, pageMeta, parse } from '../lib/http.ts';

const doctorSelect = { id: true, name: true, avatarUrl: true, phone: true, degree: true, specialization: true } as const;

const conversationDto = async (c: {
  id: string;
  type: string;
  doctor: { id: string; name: string | null; avatarUrl: string | null; phone: string; degree: string | null; specialization: string | null } | null;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  userLastReadAt: Date | null;
  blockedAt: Date | null;
}) => ({
  id: c.id,
  type: c.type,
  doctor: c.doctor,
  lastMessage: c.lastMessageText,
  lastMessageAt: c.lastMessageAt,
  unreadCount: await prisma.message.count({
    where: {
      conversationId: c.id,
      senderType: { not: 'USER' },
      ...(c.userLastReadAt ? { createdAt: { gt: c.userLastReadAt } } : {})
    }
  }),
  isBlocked: Boolean(c.blockedAt)
});

const loadConversation = async (id: string, userId: string) => {
  const conversation = await prisma.conversation.findFirst({ where: { id, userId }, include: { doctor: { select: doctorSelect } } });
  if (!conversation) throw notFound('Conversation not found.');
  return conversation;
};

/** DoctorListForChat ("Message To Doctor"). */
export const listConversations = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { type } = parse(z.object({ type: z.enum(['DOCTOR', 'AURA']).default('DOCTOR') }), req.query);
  const { page, limit, skip, take } = getPagination(req);
  const where = { userId, type };
  const [total, rows] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip,
      take,
      include: { doctor: { select: doctorSelect } }
    })
  ]);
  res.status(200).json({
    message: 'Conversations fetched successfully.',
    code: 200,
    data: await Promise.all(rows.map(conversationDto)),
    pagination: pageMeta(page, limit, total)
  });
};

const openSchema = z.union([
  z.object({ type: z.literal('DOCTOR').default('DOCTOR'), doctorId: z.string().min(1) }),
  z.object({ type: z.literal('AURA') })
]);

/** Opens (get-or-create) a chat with a doctor, or the "Chat with Aura Specialist" thread. */
export const openConversation = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(openSchema, req.body);

  let conversation;
  if ('doctorId' in input) {
    const doctor = await prisma.doctor.findFirst({ where: { id: input.doctorId, isActive: true }, select: { id: true } });
    if (!doctor) throw notFound('Doctor not found.');
    conversation = await prisma.conversation.upsert({
      where: { userId_doctorId: { userId, doctorId: doctor.id } },
      create: { userId, doctorId: doctor.id, type: 'DOCTOR' },
      update: {},
      include: { doctor: { select: doctorSelect } }
    });
  } else {
    conversation =
      (await prisma.conversation.findFirst({ where: { userId, type: 'AURA' }, include: { doctor: { select: doctorSelect } } })) ??
      (await prisma.conversation.create({ data: { userId, type: 'AURA' }, include: { doctor: { select: doctorSelect } } }));
  }

  res.status(200).json({ message: 'Conversation ready.', code: 200, data: await conversationDto(conversation) });
};

/** Message history, newest first. Pass ?before=<ISO date> to load older pages. */
export const listMessages = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const conversation = await loadConversation(idParam(req), userId);
  const { before, limit } = parse(
    z.object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }),
    req.query
  );
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, senderType: true, text: true, createdAt: true }
  });
  res.status(200).json({
    message: 'Messages fetched successfully.',
    code: 200,
    data: messages,
    hasMore: messages.length === limit
  });
};

export const sendMessage = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const conversation = await loadConversation(idParam(req), userId);
  if (conversation.blockedAt) throw forbidden('You have blocked this conversation. Unblock it to send messages.');
  const { text } = parse(z.object({ text: z.string().trim().min(1, 'Message cannot be empty.').max(2000) }), req.body);

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: conversation.id, senderType: 'USER', text, createdAt: now },
      select: { id: true, senderType: true, text: true, createdAt: true }
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageText: text, lastMessageAt: now, userLastReadAt: now }
    })
  ]);
  res.status(201).json({ message: 'Message sent.', code: 201, data: message });
};

export const markConversationRead = async (req: Request, res: Response) => {
  const conversation = await loadConversation(idParam(req), currentUserId(req));
  await prisma.conversation.update({ where: { id: conversation.id }, data: { userLastReadAt: new Date() } });
  res.status(200).json({ message: 'Conversation marked as read.', code: 200 });
};

/** ChatWithDoctor menu "Block" (and unblock). */
export const setConversationBlocked = async (req: Request, res: Response) => {
  const conversation = await loadConversation(idParam(req), currentUserId(req));
  const { blocked } = parse(z.object({ blocked: z.boolean() }), req.body);
  if (conversation.type !== 'DOCTOR') throw badRequest('Only doctor conversations can be blocked.');
  await prisma.conversation.update({ where: { id: conversation.id }, data: { blockedAt: blocked ? new Date() : null } });
  res.status(200).json({ message: blocked ? 'Conversation blocked.' : 'Conversation unblocked.', code: 200, data: { isBlocked: blocked } });
};
