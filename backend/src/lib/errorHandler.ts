import type { Response } from 'express';

type ErrorPayload = {
  name?: string;
  message?: string;
  code?: string;
  meta?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractErrorPayload = (error: unknown): ErrorPayload | undefined => {
  if (!error) return undefined;
  if (error instanceof Error) {
    const payload: ErrorPayload = {
      name: error.name,
      message: error.message
    };

    if (isRecord(error)) {
      if (typeof error.code === 'string') payload.code = error.code;
      if (error.meta !== undefined) payload.meta = error.meta;
    }

    return payload;
  }

  if (isRecord(error)) {
    return {
      name: typeof error.name === 'string' ? error.name : undefined,
      message: typeof error.message === 'string' ? error.message : undefined,
      code: typeof error.code === 'string' ? error.code : undefined,
      meta: error.meta
    };
  }

  return { message: String(error) };
};

const getStatusCode = (payload?: ErrorPayload) => {
  if (!payload) return 500;
  if (payload.name === 'PrismaClientValidationError') return 400;
  if (payload.code === 'P2002') return 409;
  if (payload.code === 'P2025') return 404;
  if (payload.code === 'P2003') return 409;
  return 500;
};

export const sendError = (
  res: Response,
  error: unknown,
  fallbackMessage = 'Something went wrong.'
) => {
  const payload = extractErrorPayload(error);
  const statusCode = getStatusCode(payload);

  return res.status(statusCode).json({
    message: fallbackMessage,
    error: payload
  });
};
