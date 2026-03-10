import { Router } from 'express';
import {
 getAllHospitals,
 getHospitalById,
 registerHospital,
 deleteHospital,
 updateHospital
} from '../controllers/hospital.controller.ts';

const router = Router();

router.get('/all', getAllHospitals);
router.get('/:id', getHospitalById);
router.post('/create', registerHospital);
router.put('/update', updateHospital);
router.patch('/update/:hospitalId', updateHospital);
router.delete('/:id', deleteHospital);

export default router;
