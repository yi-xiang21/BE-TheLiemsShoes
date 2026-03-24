const express = require('express');
const router = express.Router();
const { uploadProductImages, addProduct, updateProduct, deleteProduct, getProducts, getProductById, updateStock, getProductTypes, getProductsByType, getProductsBySize, filterProductsByPrice, sortProducts } = require('../controllers/productController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

//Các method
router.post('/', authenticateToken, requireAdmin, uploadProductImages, addProduct);
router.put('/:id', authenticateToken, requireAdmin, uploadProductImages, updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, deleteProduct);
router.get('/', getProducts);
router.get('/types', getProductTypes);
router.get('/type/:type', getProductsByType);
router.get('/:id', getProductById);
router.put('/:id/stock', authenticateToken, requireAdmin, updateStock);
router.get('/size/:size', getProductsBySize);
router.get('/price', filterProductsByPrice);
router.get('/sort', sortProducts);

module.exports = router;