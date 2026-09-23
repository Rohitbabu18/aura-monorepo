import { randomUUID } from 'node:crypto';
import { HttpError } from '../lib/http.ts';

/**
 * Payment gateway boundary. No gateway is integrated yet: outside production a mock provider
 * approves the charge immediately so booking flows can be exercised end to end.
 */
export const chargePayment = async (payment: { id: string; amount: number; currency: string }) => {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider) {
    throw new HttpError(501, `Payment provider "${provider}" is not implemented yet.`);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new HttpError(503, 'Payments are not configured.');
  }
  return { provider: 'mock', providerRef: `mock_${randomUUID()}`, status: 'SUCCESS' as const };
};
