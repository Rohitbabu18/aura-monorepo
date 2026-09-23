import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { cleanupOnError, uploader } from '../lib/upload.ts';
import {
  createAssistantRequest,
  createComplaint,
  createFeedback,
  getAssistantRequest,
  listAssistantRequests,
  listComplaints
} from '../controllers/support.controller.ts';

const privateUpload = uploader({ visibility: 'PRIVATE', accept: 'document' });

export const assistantRouter = Router();
assistantRouter.use(requireAuth);
assistantRouter.get('/', listAssistantRequests);
assistantRouter.post('/', cleanupOnError, privateUpload.single('attachment'), createAssistantRequest);
assistantRouter.get('/:id', getAssistantRequest);

export const complaintRouter = Router();
complaintRouter.use(requireAuth);
complaintRouter.get('/', listComplaints);
complaintRouter.post('/', cleanupOnError, privateUpload.single('evidence'), createComplaint);

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);
feedbackRouter.post('/', createFeedback);
