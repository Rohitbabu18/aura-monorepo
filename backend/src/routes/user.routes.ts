import { Router } from "express";
import { signin, register, updateUserById, getUserById, deleteUser } from "../controllers/user.controller.ts";

const router = Router();

router.get('/:id', getUserById);
router.post('/signin',signin)
router.post('/register',register)
router.patch('/update/:id', updateUserById);
router.delete('/delete/:id', deleteUser);

export default router;