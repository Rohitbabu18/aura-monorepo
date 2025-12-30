import { Router } from 'express';
import {
  register,
  deleteUser,
  getAllUsers,
  getUserById
} from '../controllers/user.controller.ts';

const router = Router();

router.get('/getAllUsers', getAllUsers);
router.post('/getUserById', getUserById);
router.post('/register', register);
router.delete('/deleteUser', deleteUser);

export default router;
