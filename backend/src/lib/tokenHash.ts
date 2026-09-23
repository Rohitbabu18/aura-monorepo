import { createHash } from 'node:crypto';

export const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');
