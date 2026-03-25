const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Đặt hàng (User)
router.post('/create', authenticateToken, orderController.createOrder);

// Lấy danh sách đơn hàng (Admin)
// Lưu ý: Route này nên có thêm middleware check role admin
// router.get('/', authenticateToken, authorize('admin'), orderController.getAllOrders);
router.get('/', authenticateToken, orderController.getAllOrders); 

// Lấy đơn hàng của cá nhân (User)
router.get('/my-orders', authenticateToken, orderController.getMyOrders);

// Lấy chi tiết đơn hàng (Admin & User sở hữu)
router.get('/:id', authenticateToken, orderController.getOrderDetails);

// Cập nhật trạng thái đơn (Admin)
router.put('/:id/status', authenticateToken, orderController.updateOrderStatus);

module.exports = router;