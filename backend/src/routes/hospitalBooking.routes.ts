import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  cancelHospitalBooking,
  createHospitalBooking,
  getHospitalBooking,
  listHospitalBookings,
  rescheduleHospitalBooking
} from '../controllers/hospitalBooking.controller.ts';

const router = Router();

router.use(requireAuth);

router.get('/', listHospitalBookings);
router.post('/', createHospitalBooking);
router.get('/:id', getHospitalBooking);
router.post('/:id/cancel', cancelHospitalBooking);
router.post('/:id/reschedule', rescheduleHospitalBooking);

export default router;
