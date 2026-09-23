import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client/index.js';
import { prisma } from '../lib/prisma.ts';
import { badRequest, currentUserId, getPagination, idParam, notFound, pageMeta, parse } from '../lib/http.ts';
import { labelOf } from '../lib/meta.ts';
import { fileDto, persistFiles } from '../lib/upload.ts';
import { notify } from '../services/notify.ts';

const text = (max: number) => z.string().trim().min(1).max(max);

const locationFields = {
  locationText: z.string().trim().max(300).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  details: z.string().trim().max(1000).optional()
};

// Field requirements per "Hire Assistent" form.
const assistantSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('DOCTOR'), doctorName: text(100).optional(), ...locationFields }),
  z.object({ type: z.literal('HOSPITAL'), hospitalName: text(150), ...locationFields }),
  z.object({ type: z.literal('MEDICINE'), medicineName: text(150), ...locationFields }),
  z.object({
    type: z.literal('BLOOD_DONATION'),
    bloodGroup: text(10),
    hospitalName: text(150).optional(),
    ...locationFields
  }),
  z.object({
    type: z.literal('JOB'),
    qualification: text(150),
    workExperience: text(150).optional(),
    expectedSalary: text(50).optional(),
    ...locationFields
  })
]);

const assistantInclude = { attachment: true } as const;

const assistantDto = (r: Prisma.AssistantRequestGetPayload<{ include: typeof assistantInclude }>) => ({
  ...r,
  typeLabel: labelOf('assistantRequestType', r.type),
  attachment: r.attachment ? fileDto(r.attachment) : null
});

/**
 * AssForDoctor / AssForHospital / AssForMedicine / AssForBloodDonation / AssForJob "Submit".
 * Multipart with optional "attachment" (prescription for MEDICINE, resume for JOB), or plain JSON.
 */
export const createAssistantRequest = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(assistantSchema, req.body);

  if (req.file && input.type !== 'MEDICINE' && input.type !== 'JOB') {
    throw badRequest('Attachments are only accepted for medicine and job requests.');
  }
  const [attachment] = await persistFiles(req.file ? [req.file] : [], {
    ownerId: userId,
    purpose: input.type === 'MEDICINE' ? 'PRESCRIPTION' : 'RESUME',
    visibility: 'PRIVATE'
  });

  const request = await prisma.assistantRequest.create({
    data: { userId, ...input, attachmentId: attachment?.id },
    include: assistantInclude
  });

  await notify(userId, 'ASSISTANT', 'Assistant booked',
    'Your assistant has been booked, we will notify you soon.', { assistantRequestId: request.id });

  res.status(201).json({
    message: 'Your assistant has been booked, we will notify you soon.',
    code: 201,
    data: assistantDto(request)
  });
};

export const listAssistantRequests = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { page, limit, skip, take } = getPagination(req);
  const [total, rows] = await Promise.all([
    prisma.assistantRequest.count({ where: { userId } }),
    prisma.assistantRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take, include: assistantInclude })
  ]);
  res.status(200).json({
    message: 'Assistant requests fetched successfully.',
    code: 200,
    data: rows.map(assistantDto),
    pagination: pageMeta(page, limit, total)
  });
};

export const getAssistantRequest = async (req: Request, res: Response) => {
  const request = await prisma.assistantRequest.findFirst({
    where: { id: idParam(req), userId: currentUserId(req) },
    include: assistantInclude
  });
  if (!request) throw notFound('Request not found.');
  res.status(200).json({ message: 'Request fetched successfully.', code: 200, data: assistantDto(request) });
};

const complaintSchema = z.object({
  target: z.enum(['DOCTOR', 'NURSE', 'HOSPITAL', 'ASSISTANT']),
  doctorId: z.string().min(1).optional(),
  hospitalId: z.string().min(1).optional(),
  subjectName: z.string().trim().max(150).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  clinicName: z.string().trim().max(150).optional(),
  registrationNo: z.string().trim().max(100).optional(),
  description: z.string().trim().min(1, 'Please describe your problem.').max(300)
});

/** Drawer "Report a Complaint" (multipart, optional "evidence" file). */
export const createComplaint = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(complaintSchema, req.body);

  if (input.doctorId && !(await prisma.doctor.findUnique({ where: { id: input.doctorId }, select: { id: true } }))) {
    throw badRequest('Doctor not found.');
  }
  if (input.hospitalId && !(await prisma.hospital.findUnique({ where: { id: input.hospitalId }, select: { id: true } }))) {
    throw badRequest('Hospital not found.');
  }

  const [evidence] = await persistFiles(req.file ? [req.file] : [], {
    ownerId: userId,
    purpose: 'COMPLAINT_EVIDENCE',
    visibility: 'PRIVATE'
  });
  const complaint = await prisma.complaint.create({
    data: { userId, ...input, evidenceId: evidence?.id },
    include: { evidence: true }
  });

  res.status(201).json({
    message: 'We received your complaint, we will take action shortly.',
    code: 201,
    data: { ...complaint, evidence: complaint.evidence ? fileDto(complaint.evidence) : null }
  });
};

export const listComplaints = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const { page, limit, skip, take } = getPagination(req);
  const [total, rows] = await Promise.all([
    prisma.complaint.count({ where: { userId } }),
    prisma.complaint.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take, include: { evidence: true } })
  ]);
  res.status(200).json({
    message: 'Complaints fetched successfully.',
    code: 200,
    data: rows.map((c) => ({ ...c, evidence: c.evidence ? fileDto(c.evidence) : null })),
    pagination: pageMeta(page, limit, total)
  });
};

/** Drawer "Feedback & Suggestions". */
export const createFeedback = async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const input = parse(
    z.object({
      subject: z.string().trim().min(1, 'Subject is required.').max(150),
      message: z.string().trim().min(1, 'Please describe your feedback.').max(300)
    }),
    req.body
  );
  const feedback = await prisma.feedback.create({ data: { userId, ...input } });
  res.status(201).json({ message: 'Thank you for your feedback or suggestion.', code: 201, data: feedback });
};
