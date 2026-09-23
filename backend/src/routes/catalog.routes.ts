import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.ts';
import {
  getConfig,
  getHome,
  getMeta,
  listBanners,
  listHelpArticles,
  listSpecialities,
  listSymptoms
} from '../controllers/catalog.controller.ts';

const router = Router();

router.get('/meta', getMeta);
router.get('/home', optionalAuth, getHome);
router.get('/banners', listBanners);
router.get('/symptoms', listSymptoms);
router.get('/specialities', listSpecialities);
router.get('/config', getConfig);
router.get('/help-articles', listHelpArticles);

export default router;
