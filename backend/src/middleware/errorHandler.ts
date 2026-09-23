import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../lib/http.ts';
import { sendError } from '../lib/errorHandler.ts';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}`, code: 404 });
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      message: error.message,
      code: error.status,
      ...(error.details !== undefined ? { errors: error.details } : {})
    });
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : error.message;
    return res.status(400).json({ message, code: 400 });
  }

  if (error instanceof SyntaxError && 'body' in (error as object)) {
    return res.status(400).json({ message: 'Malformed JSON body.', code: 400 });
  }

  console.error(error);
  return sendError(res, error, 'Something went wrong.');
};
