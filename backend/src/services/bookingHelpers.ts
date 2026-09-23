import { prisma } from '../lib/prisma.ts';
import { badRequest } from '../lib/http.ts';

/** Validates symptom ids and returns them as a Prisma connect list. */
export const connectSymptoms = async (symptomIds: string[]) => {
  if (symptomIds.length === 0) return [];
  const found = await prisma.symptom.findMany({ where: { id: { in: symptomIds }, isActive: true }, select: { id: true } });
  if (found.length !== new Set(symptomIds).size) throw badRequest('One or more symptoms are invalid.');
  return found.map((s) => ({ id: s.id }));
};

/** Validates that report files belong to the user and returns them as a connect list. */
export const connectOwnReports = async (userId: string, reportIds: string[]) => {
  if (reportIds.length === 0) return [];
  const found = await prisma.fileObject.findMany({
    where: { id: { in: reportIds }, ownerId: userId, purpose: 'MEDICAL_REPORT' },
    select: { id: true }
  });
  if (found.length !== new Set(reportIds).size) throw badRequest('One or more reports are invalid.');
  return found.map((f) => ({ id: f.id }));
};

export const symptomSelect = { select: { id: true, name: true, iconUrl: true } } as const;
