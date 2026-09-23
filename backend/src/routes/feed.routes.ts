import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { cleanupOnError, uploader } from '../lib/upload.ts';
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getPost,
  likePost,
  listComments,
  listPosts,
  savePost,
  unlikePost,
  unsavePost
} from '../controllers/feed.controller.ts';

export const postRouter = Router();
const postUpload = uploader({ visibility: 'PUBLIC', accept: 'document' });

postRouter.use(requireAuth);
postRouter.get('/', listPosts);
postRouter.post(
  '/',
  cleanupOnError,
  postUpload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'files', maxCount: 5 }
  ]),
  createPost
);
postRouter.get('/:id', getPost);
postRouter.delete('/:id', deletePost);
postRouter.post('/:id/like', likePost);
postRouter.delete('/:id/like', unlikePost);
postRouter.post('/:id/save', savePost);
postRouter.delete('/:id/save', unsavePost);
postRouter.get('/:id/comments', listComments);
postRouter.post('/:id/comments', createComment);

export const commentRouter = Router();
commentRouter.use(requireAuth);
commentRouter.delete('/:id', deleteComment);
