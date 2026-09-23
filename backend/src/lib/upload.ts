import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { prisma } from './prisma.ts';
import { badRequest } from './http.ts';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const MAX_FILE_MB = Number(process.env.UPLOAD_MAX_FILE_MB || 10);

type Visibility = 'PUBLIC' | 'PRIVATE';
type Purpose =
  | 'AVATAR'
  | 'MEDICAL_REPORT'
  | 'POST_IMAGE'
  | 'POST_ATTACHMENT'
  | 'PRESCRIPTION'
  | 'RESUME'
  | 'COMPLAINT_EVIDENCE'
  | 'OTHER';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DOCUMENT_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const folderFor = (visibility: Visibility) => path.join(UPLOAD_DIR, visibility.toLowerCase());

for (const visibility of ['PUBLIC', 'PRIVATE'] as const) {
  fs.mkdirSync(folderFor(visibility), { recursive: true });
}

type UploaderOptions = {
  visibility: Visibility;
  accept: 'image' | 'document';
};

/**
 * Multer middleware writing straight into the public or private upload folder.
 * (Handlers are re-typed because @types/multer resolves the monorepo's hoisted Express 4 typings.)
 */
export const uploader = ({ visibility, accept }: UploaderOptions) => {
  const instance = multer({
    storage: multer.diskStorage({
      destination: folderFor(visibility),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
        cb(null, `${randomUUID()}${ext}`);
      }
    }),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => {
      const allowed = accept === 'image' ? IMAGE_TYPES : DOCUMENT_TYPES;
      if (!allowed.includes(file.mimetype)) {
        cb(badRequest(`Unsupported file type: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    }
  });

  return {
    single: (field: string) => instance.single(field) as unknown as RequestHandler,
    array: (field: string, maxCount: number) => instance.array(field, maxCount) as unknown as RequestHandler,
    fields: (fields: { name: string; maxCount: number }[]) => instance.fields(fields) as unknown as RequestHandler
  };
};

const collectFiles = (req: Request): Express.Multer.File[] => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files) return Object.values(req.files).flat();
  return [];
};

/** Deletes files multer wrote for this request (used when the request fails). */
export const discardUploads = (req: Request) => {
  for (const file of collectFiles(req)) {
    fs.promises.unlink(file.path).catch(() => undefined);
  }
};

/** Ensures uploaded files are cleaned up if a later handler throws or responds with an error. */
export const cleanupOnError = (req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) discardUploads(req);
  });
  next();
};

export const persistFiles = async (
  files: Express.Multer.File[] | undefined,
  options: { ownerId: string; purpose: Purpose; visibility: Visibility }
) => {
  if (!files || files.length === 0) return [];
  return prisma.fileObject.createManyAndReturn({
    data: files.map((file) => ({
      ownerId: options.ownerId,
      purpose: options.purpose,
      visibility: options.visibility,
      storageKey: `${options.visibility.toLowerCase()}/${file.filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    }))
  });
};

export const absolutePath = (storageKey: string) => {
  const resolved = path.resolve(UPLOAD_DIR, storageKey);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) throw badRequest('Invalid file path.');
  return resolved;
};

export const removeStoredFile = async (storageKey: string) => {
  await fs.promises.unlink(absolutePath(storageKey)).catch(() => undefined);
};

const publicBase = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

type FileLike = {
  id: string;
  storageKey: string;
  visibility: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

const SIGNED_URL_TTL_SECONDS = Number(process.env.FILE_URL_TTL_SECONDS || 60 * 60);

const signature = (fileId: string, expires: number) =>
  createHmac('sha256', process.env.JWT_SECRET ?? '').update(`${fileId}:${expires}`).digest('hex');

/** Validates the ?expires=&sig= pair of a signed private-file URL. */
export const isValidFileSignature = (fileId: string, expires: unknown, sig: unknown) => {
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000 || typeof sig !== 'string') return false;
  const expected = Buffer.from(signature(fileId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/**
 * Public files are served statically. Private files (medical reports, prescriptions, ...) go through
 * /api/files/:id with a short-lived signature, so the app can open them with Linking.openURL.
 */
export const fileUrl = (file: Pick<FileLike, 'id' | 'storageKey' | 'visibility'>) => {
  if (file.visibility === 'PUBLIC') {
    return `${publicBase()}/uploads/${file.storageKey.replace(/^public\//, '')}`;
  }
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  return `${publicBase()}/api/files/${file.id}?expires=${expires}&sig=${signature(file.id, expires)}`;
};

export const fileDto = (file: FileLike) => ({
  id: file.id,
  name: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  url: fileUrl(file),
  createdAt: file.createdAt
});
