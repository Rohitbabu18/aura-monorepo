import { Router } from "express";
import {
  signin,
  register,
  updateUserById,
  getUserById,
  deleteUser,
  refreshUserSession,
  logoutUser,
  resetPassword
} from "../controllers/user.controller.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

router.post('/signin',signin)
router.post('/refresh-token', refreshUserSession)
router.post('/logout', logoutUser)
router.post('/register',register)
router.post('/reset-password', resetPassword)
router.get('/:id', requireAuth, getUserById);
router.patch('/update/:id', requireAuth, updateUserById);
router.delete('/delete/:id', requireAuth, deleteUser);

export default router;
