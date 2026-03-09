const express = require('express');
const router = express.Router();
const { getListUsers, addUser, updateUser, deleteUser } = require('../controllers/userController');

// Các method
router.get('/', getListUsers);
router.post('/', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
