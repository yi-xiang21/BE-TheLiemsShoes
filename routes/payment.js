const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
	createMomoPayment,
	handleMomoIpn,
	finalizeMomoOrder
} = require('../controllers/paymentController');

router.post('/momo/create', authenticateToken, createMomoPayment);
router.post('/momo/ipn', handleMomoIpn);
router.post('/momo/finalize', authenticateToken, finalizeMomoOrder);

module.exports = router;
