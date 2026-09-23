import { Router } from 'express';
import { confirmOtp, requestOtp } from '../controllers/otp.controller.ts';

const router = Router();

router.post('/send', requestOtp);
router.post('/verify', confirmOtp);

export default router;
