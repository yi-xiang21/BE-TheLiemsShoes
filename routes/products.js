const express = require('express');
const router = express.Router();
const { addProduct, updateProduct, deleteProduct } = require('../controllers/productController');

//Các method
router.post('/', addProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;