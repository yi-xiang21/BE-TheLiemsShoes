const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, cartController.getCart);
router.post('/', authenticateToken, cartController.addToCart);
router.put('/:itemId', authenticateToken, cartController.updateCartItem);
router.delete('/:itemId', authenticateToken, cartController.removeCartItem);
router.delete('/', authenticateToken, cartController.clearCart);

module.exports = router;