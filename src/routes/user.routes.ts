import { Router } from 'express';
import {
  register,
  registerFromBasicInfo,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUserById
} from '../controllers/user.controller.ts';

const router = Router();

router.get('/all', getAllUsers);
router.get('/:id', getUserById);
router.post('/signin', register);
router.post('/register', registerFromBasicInfo);
router.patch('/update/:id', updateUserById);
router.delete('/delete/:id', deleteUser);

export default router;
