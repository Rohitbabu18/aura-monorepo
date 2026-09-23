import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  attachAppointmentReports,
  cancelAppointment,
  createAppointment,
  detachAppointmentReport,
  getAppointment,
  listAppointments,
  payAppointment,
  rescheduleAppointment
} from '../controllers/appointment.controller.ts';

const router = Router();

router.use(requireAuth);

router.get('/', listAppointments);
router.post('/', createAppointment);
router.get('/:id', getAppointment);
router.post('/:id/pay', payAppointment);
router.post('/:id/cancel', cancelAppointment);
router.post('/:id/reschedule', rescheduleAppointment);
router.post('/:id/reports', attachAppointmentReports);
router.delete('/:id/reports/:reportId', detachAppointmentReport);

export default router;
