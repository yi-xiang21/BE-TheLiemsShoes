const express = require('express');
const router = express.Router();
const { getListUsers, getUserById, addUser, updateUser, deleteUser } = require('../controllers/userController');

// Các method
router.get('/', getListUsers);
router.get('/:id', getUserById);
router.post('/', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
