import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client/index.js';
import { prisma } from '../lib/prisma.ts';
import { badRequest, currentUserId, forbidden, getPagination, idListSchema, idParam, notFound, pageMeta, parse } from '../lib/http.ts';
import { fileDto, fileUrl, persistFiles, removeStoredFile } from '../lib/upload.ts';

const authorSelect = {
  authorType: true,
  authorUser: { select: { id: true, name: true, avatarUrl: true } },
  authorDoctor: { select: { id: true, name: true, avatarUrl: true, specialization: true, degree: true } }
} as const;

const postInclude = {
  authorUser: authorSelect.authorUser,
  authorDoctor: authorSelect.authorDoctor,
  tags: { select: { id: true, name: true } },
  media: { orderBy: { position: 'asc' as const }, include: { file: true } }
} as const;

type AuthorFields = {
  authorType: string;
  authorUser: { id: string; name: string | null; avatarUrl: string | null } | null;
  authorDoctor: { id: string; name: string | null; avatarUrl: string | null; specialization?: string | null; degree?: string | null } | null;
};

const authorDto = (a: AuthorFields) =>
  a.authorType === 'DOCTOR' && a.authorDoctor
    ? { type: 'DOCTOR', ...a.authorDoctor }
    : { type: 'USER', id: a.authorUser?.id ?? null, name: a.authorUser?.name ?? null, avatarUrl: a.authorUser?.avatarUrl ?? null };

type PostRecord = Prisma.PostGetPayload<{ include: typeof postInclude }>;

const postDto = (post: PostRecord, me: { liked: Set<string>; saved: Set<string>; userId: string }) => ({
  id: post.id,
  title: post.title,
  body: post.body,
  visibility: post.visibility,
  author: authorDto(post),
  isMine: post.authorUserId === me.userId,
  tags: post.tags,
  images: post.media.filter((m) => m.kind === 'IMAGE').map((m) => ({ id: m.file.id, url: fileUrl(m.file) })),
  attachments: post.media.filter((m) => m.kind === 'FILE').map((m) => fileDto(m.file)),
  likeCount: post.likeCount,
  commentCount: post.commentCount,
  likedByMe: me.liked.has(post.id),
  savedByMe: me.saved.has(post.id),
  createdAt: post.createdAt
});

const viewerState = async (userId: string, postIds: string[]) => {
  const [likes, saves] = await Promise.all([
    prisma.postLike.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.postSave.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } })
  ]);
  return { userId, liked: new Set(likes.map((l) => l.postId)), saved: new Set(saves.map((s) => s.postId)) };
};

// Patients see public posts plus their own (including "Share With: Doctors" ones).
const visibleTo = (userId: string) => ({ OR: [{ visibility: 'PUBLIC' as const }, { authorUserId: userId }] });

/** Feed tab. Filters: ?tagId=, ?saved=true, ?mine=true */
export const listPosts = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const q = parse(
    z.object({
      tagId: z.string().optional(),
      saved: z.enum(['true', 'false']).optional(),
      mine: z.enum(['true', 'false']).optional()
    }),
    req.query
  );
  const { page, limit, skip, take } = getPagination(req);
  const where = {
    AND: [
      visibleTo(userId),
      ...(q.tagId ? [{ tags: { some: { id: q.tagId } } }] : []),
      ...(q.saved === 'true' ? [{ saves: { some: { userId } } }] : []),
      ...(q.mine === 'true' ? [{ authorUserId: userId }] : [])
    ]
  };

  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: postInclude })
  ]);
  const me = await viewerState(userId, posts.map((p) => p.id));
  res.status(200).json({
    message: 'Posts fetched successfully.',
    code: 200,
    data: posts.map((p) => postDto(p, me)),
    pagination: pageMeta(page, limit, total)
  });
};

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(150),
  body: z.string().trim().max(5000).optional(),
  visibility: z.enum(['PUBLIC', 'DOCTORS']).default('PUBLIC'),
  tagIds: idListSchema
});

/** ShareCase "Post" (multipart: images[] from gallery/camera, files[] documents, plus fields). */
export const createPost = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(createSchema, req.body);
  const uploaded = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const images = uploaded.images ?? [];
  const attachments = uploaded.files ?? [];

  if (images.some((f) => !f.mimetype.startsWith('image/'))) throw badRequest('"images" only accepts image files.');

  if (input.tagIds.length > 0) {
    const tags = await prisma.speciality.count({ where: { id: { in: input.tagIds }, isActive: true } });
    if (tags !== new Set(input.tagIds).size) throw badRequest('One or more specialities are invalid.');
  }

  const [imageFiles, documentFiles] = await Promise.all([
    persistFiles(images, { ownerId: userId, purpose: 'POST_IMAGE', visibility: 'PUBLIC' }),
    persistFiles(attachments, { ownerId: userId, purpose: 'POST_ATTACHMENT', visibility: 'PUBLIC' })
  ]);

  const post = await prisma.post.create({
    data: {
      authorType: 'USER',
      authorUserId: userId,
      title: input.title,
      body: input.body,
      visibility: input.visibility,
      tags: { connect: input.tagIds.map((id) => ({ id })) },
      media: {
        create: [
          ...imageFiles.map((f, i) => ({ fileId: f.id, kind: 'IMAGE' as const, position: i })),
          ...documentFiles.map((f, i) => ({ fileId: f.id, kind: 'FILE' as const, position: i }))
        ]
      }
    },
    include: postInclude
  });

  res.status(201).json({
    message: 'Post shared successfully.',
    code: 201,
    data: postDto(post, { userId, liked: new Set(), saved: new Set() })
  });
};

const findVisiblePost = async (id: string, userId: string) => {
  const post = await prisma.post.findFirst({ where: { id, ...visibleTo(userId) }, include: postInclude });
  if (!post) throw notFound('Post not found.');
  return post;
};

const commentSelect = {
  id: true,
  text: true,
  createdAt: true,
  parentId: true,
  ...authorSelect
} as const;

const commentDto = (c: { id: string; text: string; createdAt: Date; parentId: string | null } & AuthorFields) => ({
  id: c.id,
  text: c.text,
  parentId: c.parentId,
  author: authorDto(c),
  createdAt: c.createdAt
});

/** Top-level comments with their replies (CaseDetail). */
const loadComments = async (postId: string, skip: number, take: number) => {
  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    select: {
      ...commentSelect,
      _count: { select: { replies: true } },
      replies: { orderBy: { createdAt: 'asc' }, take: 20, select: commentSelect }
    }
  });
  return comments.map((c) => ({ ...commentDto(c), replyCount: c._count.replies, replies: c.replies.map(commentDto) }));
};

/** CaseDetail */
export const getPost = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const post = await findVisiblePost(idParam(req), userId);
  const [me, comments] = await Promise.all([viewerState(userId, [post.id]), loadComments(post.id, 0, 20)]);
  res.status(200).json({ message: 'Post fetched successfully.', code: 200, data: { ...postDto(post, me), comments } });
};

export const deletePost = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const post = await prisma.post.findUnique({ where: { id: idParam(req) }, include: { media: { include: { file: true } } } });
  if (!post) throw notFound('Post not found.');
  if (post.authorUserId !== userId) throw forbidden('You can only delete your own posts.');
  await prisma.$transaction([
    prisma.post.delete({ where: { id: post.id } }),
    prisma.fileObject.deleteMany({ where: { id: { in: post.media.map((m) => m.fileId) } } })
  ]);
  await Promise.all(post.media.map((m) => removeStoredFile(m.file.storageKey)));
  res.status(200).json({ message: 'Post deleted.', code: 200 });
};

const toggle = (kind: 'like' | 'save', on: boolean) => async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const post = await findVisiblePost(idParam(req), userId);
  const key = { userId_postId: { userId, postId: post.id } };

  if (kind === 'like') {
    const existing = await prisma.postLike.findUnique({ where: key });
    if (on && !existing) {
      await prisma.$transaction([
        prisma.postLike.create({ data: { userId, postId: post.id } }),
        prisma.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } })
      ]);
    } else if (!on && existing) {
      await prisma.$transaction([
        prisma.postLike.delete({ where: key }),
        prisma.post.update({ where: { id: post.id }, data: { likeCount: { decrement: 1 } } })
      ]);
    }
  } else if (on) {
    await prisma.postSave.upsert({ where: key, create: { userId, postId: post.id }, update: {} });
  } else {
    await prisma.postSave.deleteMany({ where: { userId, postId: post.id } });
  }

  const fresh = await prisma.post.findUniqueOrThrow({ where: { id: post.id }, select: { likeCount: true } });
  const me = await viewerState(userId, [post.id]);
  res.status(200).json({
    message: 'Updated.',
    code: 200,
    data: { likeCount: fresh.likeCount, likedByMe: me.liked.has(post.id), savedByMe: me.saved.has(post.id) }
  });
};

export const likePost = toggle('like', true);
export const unlikePost = toggle('like', false);
export const savePost = toggle('save', true);
export const unsavePost = toggle('save', false);

export const listComments = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const post = await findVisiblePost(idParam(req), userId);
  const { page, limit, skip, take } = getPagination(req);
  const [total, comments] = await Promise.all([
    prisma.comment.count({ where: { postId: post.id, parentId: null } }),
    loadComments(post.id, skip, take)
  ]);
  res.status(200).json({ message: 'Comments fetched successfully.', code: 200, data: comments, pagination: pageMeta(page, limit, total) });
};

/** CaseDetail comment box and per-comment "Reply" box (send parentId). */
export const createComment = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const post = await findVisiblePost(idParam(req), userId);
  const { text, parentId } = parse(
    z.object({ text: z.string().trim().min(1, 'Comment cannot be empty.').max(1000), parentId: z.string().optional() }),
    req.body
  );

  let rootId: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findFirst({ where: { id: parentId, postId: post.id }, select: { id: true, parentId: true } });
    if (!parent) throw badRequest('The comment you are replying to does not exist.');
    rootId = parent.parentId ?? parent.id; // replies stay one level deep
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { postId: post.id, parentId: rootId, authorType: 'USER', authorUserId: userId, text },
      select: commentSelect
    }),
    prisma.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } })
  ]);
  res.status(201).json({ message: 'Comment added.', code: 201, data: commentDto(comment) });
};

export const deleteComment = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const comment = await prisma.comment.findUnique({
    where: { id: idParam(req) },
    select: { id: true, postId: true, authorUserId: true, _count: { select: { replies: true } } }
  });
  if (!comment) throw notFound('Comment not found.');
  if (comment.authorUserId !== userId) throw forbidden('You can only delete your own comments.');
  await prisma.$transaction([
    prisma.comment.delete({ where: { id: comment.id } }),
    prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 + comment._count.replies } } })
  ]);
  res.status(200).json({ message: 'Comment deleted.', code: 200 });
};
