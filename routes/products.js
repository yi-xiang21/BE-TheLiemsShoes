const express = require('express');
const router = express.Router();
const { addProduct, updateProduct, deleteProduct, getProducts, getProductById, updateStock } = require('../controllers/productController');

//Các method
router.post('/', addProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id/stock', updateStock);

module.exports = router;