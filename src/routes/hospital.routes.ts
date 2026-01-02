import { Router } from 'express';
import {
 getAllHospitals,
 getHospitalById,
 registerHospital,
 deleteHospital,
 updateHospital
} from '../controllers/hospital.controller.ts';

const router = Router();

router.get('/getAllHospital', getAllHospitals);
router.post('/hospitalById', getHospitalById);
router.post('/create', registerHospital);
router.put('/update', updateHospital);
router.delete('/delete', deleteHospital);

export default router;
