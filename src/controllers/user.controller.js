
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
  const { email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    const isMatch = bcrypt.compare(password, exists.password);

    if (isMatch) {
      return res.status(200).json({ message: 'Sign In successfully.', data: exists, code: 200 });
    }
    return res.status(403).json({ message: 'Email already in use, Please provide valid password', code: 403 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword,
  });

  res.status(201).json({
    message: 'User Sign Up successfully.',
    data: user,
  });
};
exports.deleteUser = async (req, res) => {
  try {
    
    const { user_id } = req.body;
  
    const exists = await User.findOne({ _id: user_id });
    if (exists) {
      const userDelete = await User.deleteOne({ _id: user_id })
      return res.status(200).json({ message: 'User deleted successfully.', code: 200, data: userDelete });
    }
  
    res.status(403).json({
      message: 'Invalid user id.'
    });
  } catch (error) {
     res.status(403).json({
      message: 'Invalid user id.',
      error
    });
  }
};
exports.getAllUsers = async (req, res) => {
  const users = await User.find({});
  res.status(200).json({
    message: 'Users fetched successfully.',
    data: users,
    total:users.length
  });
}
exports.getUserById = async (req, res) => {
  try {
    
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(404).json({
        message: 'Please provide user id.',
      });
    }
    const user = await User.findById(user_id).select('-password');
    if (user) {
      return res.status(200).json({
        message: 'User fetched successfully.',
        data: user,
      });
    }
  
    res.status(404).json({
      message: 'User not found.',
    });
  } catch (error) {
     res.status(404).json({
      message: 'User not found.',
      error
    });
  }
};