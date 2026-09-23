import { Router } from 'express';
import {
  register,
  registerFromBasicInfo,
  deleteUser,
  getAllUsers,
  updateUserById
} from '../controllers/doctor.controller.ts';
import {
  addFavourite,
  createDoctorReview,
  getDoctorProfile,
  listAvailableDates,
  listDoctorReviews,
  listDoctors,
  listSlots,
  removeFavourite
} from '../controllers/doctorPublic.controller.ts';
import { optionalAuth, requireAuth } from '../middleware/auth.ts';

const router = Router();

// Patient app (public catalogue + booking helpers)
router.get('/', optionalAuth, listDoctors);
router.get('/all', getAllUsers);
router.get('/:id/available-dates', listAvailableDates);
router.get('/:id/slots', listSlots);
router.get('/:id/reviews', listDoctorReviews);
router.post('/:id/reviews', requireAuth, createDoctorReview);
router.post('/:id/favourite', requireAuth, addFavourite);
router.delete('/:id/favourite', requireAuth, removeFavourite);
router.get('/:id', optionalAuth, getDoctorProfile);

// Provider registration (web registration form)
router.post('/signin', register);
router.post('/register', registerFromBasicInfo);
router.patch('/update/:id', updateUserById);
router.delete('/delete/:id', deleteUser);

export default router;
