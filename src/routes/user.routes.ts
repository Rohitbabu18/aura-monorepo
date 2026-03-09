import { Router } from 'express';
import {
  register,
  deleteUser,
  getAllUsers,
  getUserById
} from '../controllers/user.controller.ts';

const router = Router();

router.get('/all', getAllUsers);
router.get('/:id', getUserById);
router.post('/signin', register);
router.delete('/delete/:id', deleteUser);

export default router;
