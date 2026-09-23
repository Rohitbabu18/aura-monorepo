import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.ts';
import { cleanupOnError, uploader } from '../lib/upload.ts';
import { deleteReport, downloadFile, listReports, uploadReports } from '../controllers/file.controller.ts';

export const reportRouter = Router();
const reportUpload = uploader({ visibility: 'PRIVATE', accept: 'document' });

reportRouter.use(requireAuth);
reportRouter.get('/', listReports);
reportRouter.post('/', cleanupOnError, reportUpload.array('files', 10), uploadReports);
reportRouter.delete('/:id', deleteReport);

export const fileRouter = Router();
fileRouter.get('/:id', optionalAuth, downloadFile);
