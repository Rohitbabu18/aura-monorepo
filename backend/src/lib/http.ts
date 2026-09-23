import type { Request } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Authentication required.') => new HttpError(401, message);
export const forbidden = (message = 'You are not allowed to perform this action.') => new HttpError(403, message);
export const notFound = (message = 'Resource not found.') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

// "hospitalName" -> "Hospital name"
const humanize = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Zod's default "Invalid input: expected string, received undefined" becomes "Hospital name is required." */
const issueMessage = (issue: z.core.$ZodIssue) => {
  const field = issue.path[issue.path.length - 1];
  if (issue.code === 'invalid_type' && /received undefined/.test(issue.message) && typeof field === 'string') {
    return `${humanize(field)} is required.`;
  }
  return issue.message;
};

/** Parse and validate input with a zod schema; throws a 400 with field errors on failure. */
export const parse = <T extends z.ZodType>(schema: T, input: unknown): z.infer<T> => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issueMessage(issue) }));
    throw badRequest(issues[0]?.message ?? 'Invalid request.', issues);
  }
  return result.data;
};

/** Optional field that treats "" (common from form inputs) as not provided. */
export const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const getPagination = (req: Request) => {
  const { page, limit } = parse(paginationSchema, req.query);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

export const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit)
});

/** The authenticated user id; only call behind requireAuth. */
export const currentUserId = (req: Request) => {
  if (!req.auth) throw unauthorized();
  return req.auth.userId;
};

export const idParam = (req: Request, name = 'id') => {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw badRequest(`${name} is required.`);
  return value;
};

// Common field schemas
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'Please enter a valid 10 digit phone number.');

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.');

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm (24h) format.');

/** Accepts arrays, JSON array strings and comma-separated strings (multipart forms send strings). */
export const idListSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
    return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return value;
}, z.array(z.string().min(1)).max(50));
