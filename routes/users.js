const express = require('express');
const router = express.Router();
const { getListUsers, getUserById, addUser, updateUser, deleteUser } = require('../controllers/userController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// Các method
router.get('/', authenticateToken, requireAdmin, getListUsers);
router.get('/:id', authenticateToken, requireAdmin, getUserById);
router.post('/', authenticateToken, requireAdmin, addUser);
router.put('/:id', authenticateToken, requireAdmin, updateUser);
router.delete('/:id', authenticateToken, requireAdmin, deleteUser);

module.exports = router;
