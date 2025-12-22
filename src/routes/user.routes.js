const router = require('express').Router();
const { register ,deleteUser,getAllUsers,getUserById} = require('../controllers/user.controller');

router.get('/getAllUsers', getAllUsers);
router.post('/getUserById', getUserById);
router.post('/register', register);
router.delete('/deleteUser', deleteUser);

module.exports = router;
