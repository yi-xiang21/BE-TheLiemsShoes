const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const {
    getCategories,
    getCategoryById,
    addCategory,
    updateCategory,
    deleteCategory,
    getProductByCategory
} = require('../controllers/categoryController');

// Các method
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', authenticateToken, requireAdmin, addCategory);
router.put('/:id', authenticateToken, requireAdmin, updateCategory);
router.delete('/:id', authenticateToken, requireAdmin, deleteCategory);
router.get('/category/:id', getProductByCategory);

module.exports = router;
