import { Router } from 'express';
import {
 getAllHospitals,
 registerHospital,
 deleteHospital,
 updateHospital
} from '../controllers/hospital.controller.ts';
import {
 compareHospitals,
 createHospitalReview,
 getHospitalProfile,
 listHospitalDoctors,
 listHospitalReviews,
 listHospitalRooms,
 listHospitals
} from '../controllers/hospitalPublic.controller.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();

// Patient app (public catalogue)
router.get('/', listHospitals);
router.get('/all', getAllHospitals);
router.get('/compare', compareHospitals);
router.get('/:id/rooms', listHospitalRooms);
router.get('/:id/doctors', listHospitalDoctors);
router.get('/:id/reviews', listHospitalReviews);
router.post('/:id/reviews', requireAuth, createHospitalReview);
router.get('/:id', getHospitalProfile);

// Provider registration (web registration form)
router.post('/create', registerHospital);
router.put('/update', updateHospital);
router.patch('/update/:hospitalId', updateHospital);
router.delete('/:id', deleteHospital);

export default router;
