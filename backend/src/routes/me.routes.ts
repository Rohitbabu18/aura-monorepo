import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { uploader, cleanupOnError } from '../lib/upload.ts';
import {
  changePassword,
  changePhone,
  getMe,
  getSettings,
  listFavouriteDoctors,
  updateLifestyle,
  updateMe,
  updateMedical,
  updateSettings,
  uploadAvatar
} from '../controllers/me.controller.ts';

const router = Router();
const avatarUpload = uploader({ visibility: 'PUBLIC', accept: 'image' });

router.use(requireAuth);

router.get('/', getMe);
router.patch('/', updateMe);
router.patch('/medical', updateMedical);
router.patch('/lifestyle', updateLifestyle);
router.post('/avatar', cleanupOnError, avatarUpload.single('avatar'), uploadAvatar);
router.patch('/phone', changePhone);
router.patch('/password', changePassword);
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.get('/favourite-doctors', listFavouriteDoctors);

export default router;
