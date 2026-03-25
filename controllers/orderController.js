const pool = require('../config/db');

// --- Helper: Mượn logic xác thực nếu chưa có middleware (nhưng nên dùng middleware) ---
// Ở đây giả định req.user đã có từ middleware. Nếu không, các hàm sẽ trả về 401.

// 1. Tạo đơn hàng từ giỏ hàng
const createOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        await client.query('BEGIN');

        // Lấy items trong giỏ
        const cartQuery = `
            SELECT c.id as cart_id, ci.product_id, ci.quantity, p.price, p.stock_quantity
            FROM carts c
            JOIN cart_items ci ON c.id = ci.cart_id
            JOIN products p ON ci.product_id = p.id
            WHERE c.user_id = $1
        `;
        const cartResult = await client.query(cartQuery, [userId]);

        if (cartResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Giỏ hàng trống!' });
        }

        const cartItems = cartResult.rows;
        const cartId = cartItems[0].cart_id;

        // Tính tổng tiền & Kiểm tra tồn kho
        let totalAmount = 0;
        for (const item of cartItems) {
            if (item.quantity > item.stock_quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Sản phẩm ID ${item.product_id} không đủ hàng (Còn: ${item.stock_quantity})` 
                });
            }
            totalAmount += Number(item.price) * item.quantity;
        }

        // Tạo Order
        const orderQuery = `
            INSERT INTO orders (user_id, total_amount, status) 
            VALUES ($1, $2, $3) 
            RETURNING id
        `;
        const orderResult = await client.query(orderQuery, [userId, totalAmount, 'pending']);
        const orderId = orderResult.rows[0].id;

        // Tạo Order Items & Trừ kho
        for (const item of cartItems) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.product_id, item.quantity, item.price]
            );

            await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.product_id]
            );
        }

        // Xóa sạch giỏ hàng
        await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

        await client.query('COMMIT');

        res.status(201).json({ 
            message: 'Đặt hàng thành công', 
            orderId 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi tạo đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi server khi tạo đơn hàng' });
    } finally {
        client.release();
    }
};

// 2. Lấy danh sách tất cả đơn hàng (Admin)
const getAllOrders = async (req, res) => {
    try {
        // Có thể check role ở đây: if (req.user.role !== 'admin') ...
        const query = `
            SELECT o.id, o.user_id, o.total_amount, o.status, o.created_at, u.username as user_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `;
        const result = await pool.query(query);
        
        // Format lại dữ liệu cho đẹp nếu cần
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Lỗi lấy danh sách đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// 3. Lấy đơn hàng của người dùng đang đăng nhập
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const query = `
            SELECT id, total_amount, status, created_at
            FROM orders
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [userId]);
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Lỗi lấy đơn hàng của tôi:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// 4. Lấy chi tiết đơn hàng
const getOrderDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Lấy thông tin chung đơn hàng
        const orderQuery = `
            SELECT o.*, u.username, u.email, u.phone_number, u.address
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = $1
        `;
        const orderResult = await pool.query(orderQuery, [id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
        }

        const order = orderResult.rows[0];

        // Lấy danh sách sản phẩm trong đơn
        const itemsQuery = `
            SELECT oi.*, p.product_name, 
                   (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) as image_url
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [id]);

        res.json({
            order,
            items: itemsResult.rows
        });

    } catch (error) {
        console.error('Lỗi lấy chi tiết đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// 5. Cập nhật trạng thái đơn hàng (Admin)
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // status: 'pending' | 'shipping' | 'completed' | 'cancelled'

        if (!status) {
            return res.status(400).json({ message: 'Thiếu thông tin status' });
        }

        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
        }

        res.json({ 
            message: 'Cập nhật trạng thái thành công', 
            order: result.rows[0] 
        });

    } catch (error) {
        console.error('Lỗi cập nhật trạng thái:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = {
    createOrder,
    getAllOrders,
    getMyOrders,
    getOrderDetails,
    updateOrderStatus
};
