import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.ts';
import {
  bannersAdmin,
  createPackage,
  createRoom,
  deletePackage,
  deleteRoom,
  helpArticlesAdmin,
  replyToConversation,
  setAppointmentStatus,
  setConfig,
  setDoctorAvailability,
  setDoctorHospitals,
  setHospitalBookingStatus,
  specialitiesAdmin,
  symptomsAdmin,
  updateDoctorProfile,
  updateHospitalProfile,
  updateRoom
} from '../controllers/admin.controller.ts';

const router = Router();

router.use(requireAdmin);

router.patch('/doctors/:id', updateDoctorProfile);
router.put('/doctors/:id/availability', setDoctorAvailability);
router.put('/doctors/:id/hospitals', setDoctorHospitals);

router.patch('/hospitals/:id', updateHospitalProfile);
router.post('/hospitals/:id/rooms', createRoom);
router.patch('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);
router.post('/hospitals/:id/packages', createPackage);
router.delete('/packages/:id', deletePackage);

for (const [path, handlers] of [
  ['symptoms', symptomsAdmin],
  ['specialities', specialitiesAdmin],
  ['banners', bannersAdmin],
  ['help-articles', helpArticlesAdmin]
] as const) {
  router.post(`/${path}`, handlers.create);
  router.patch(`/${path}/:id`, handlers.update);
  router.delete(`/${path}/:id`, handlers.remove);
}
router.put('/config/:key', setConfig);

router.patch('/appointments/:id/status', setAppointmentStatus);
router.patch('/hospital-bookings/:id/status', setHospitalBookingStatus);
router.post('/conversations/:id/messages', replyToConversation);

export default router;
