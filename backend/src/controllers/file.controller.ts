import fs from 'node:fs';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import { badRequest, currentUserId, forbidden, getPagination, idParam, notFound, pageMeta } from '../lib/http.ts';
import { absolutePath, fileDto, isValidFileSignature, persistFiles, removeStoredFile } from '../lib/upload.ts';

/** Drawer "Your Reports" list. */
export const listReports = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { page, limit, skip, take } = getPagination(req);
  const where = { ownerId: userId, purpose: 'MEDICAL_REPORT' as const };
  const [total, files] = await Promise.all([
    prisma.fileObject.count({ where }),
    prisma.fileObject.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take })
  ]);
  res.status(200).json({
    message: 'Reports fetched successfully.',
    code: 200,
    data: files.map(fileDto),
    pagination: pageMeta(page, limit, total)
  });
};

/** "New Upload" on Your Reports / UploadYourReports (multipart field "files", up to 10). */
export const uploadReports = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) throw badRequest('Please attach at least one file in the "files" field.');
  const saved = await persistFiles(files, { ownerId: userId, purpose: 'MEDICAL_REPORT', visibility: 'PRIVATE' });
  res.status(201).json({ message: 'Reports uploaded successfully.', code: 201, data: saved.map(fileDto) });
};

export const deleteReport = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const file = await prisma.fileObject.findFirst({
    where: { id: idParam(req), ownerId: userId, purpose: 'MEDICAL_REPORT' }
  });
  if (!file) throw notFound('Report not found.');
  await prisma.fileObject.delete({ where: { id: file.id } });
  await removeStoredFile(file.storageKey);
  res.status(200).json({ message: 'Report deleted successfully.', code: 200 });
};

/**
 * Streams a private file. Access: a valid signed URL (?expires=&sig=, as returned in every file DTO)
 * or a bearer token of the file's owner.
 */
export const downloadFile = async (req: Request, res: Response) => {
  const id = idParam(req);
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) throw notFound('File not found.');

  const signed = isValidFileSignature(id, req.query.expires, req.query.sig);
  const isOwner = req.auth?.userId === file.ownerId;
  if (file.visibility === 'PRIVATE' && !signed && !isOwner) throw forbidden('This link has expired.');

  const filePath = absolutePath(file.storageKey);
  if (!fs.existsSync(filePath)) throw notFound('File not found.');

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  fs.createReadStream(filePath).pipe(res);
};
