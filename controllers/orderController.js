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
            SELECT 
                c.id as cart_id,
                ci.product_size_id,
                ci.quantity,
                ps.stock_quantity,
                p.id AS product_id,
                p.product_name,
                p.price,
                s.size_name,
                (
                    SELECT pi.image_url
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY pi.id ASC
                    LIMIT 1
                ) AS image_url
            FROM carts c
            JOIN cart_items ci ON c.id = ci.cart_id
            JOIN product_sizes ps ON ci.product_size_id = ps.id
            JOIN products p ON ps.product_id = p.id
            JOIN sizes s ON s.id = ps.size_id
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
                    message: `Bien the san pham ID ${item.product_size_id} khong du hang (Con: ${item.stock_quantity})` 
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
                `INSERT INTO order_items (
                    order_id,
                    product_size_id,
                    snapshot_product_id,
                    snapshot_product_size_id,
                    snapshot_product_name,
                    snapshot_size_name,
                    snapshot_image_url,
                    quantity,
                    price
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    orderId,
                    item.product_size_id,
                    item.product_id,
                    item.product_size_id,
                    item.product_name,
                    item.size_name,
                    item.image_url,
                    item.quantity,
                    item.price
                ]
            );

            await client.query(
                'UPDATE product_sizes SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.product_size_id]
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
            SELECT
                o.id,
                o.total_amount,
                o.final_amount,
                o.status,
                o.created_at,
                COALESCE(pp.payment_method, 'cod') AS payment_method,
                pp.status AS payment_status,
                first_item.product_size_id,
                first_item.product_name,
                first_item.size_name,
                first_item.image_url,
                first_item.quantity,
                first_item.item_total,
                item_stat.total_items,
                item_stat.total_quantity
            FROM orders o
            LEFT JOIN LATERAL (
                SELECT payment_method, status
                FROM pending_payments
                WHERE order_id = o.id
                ORDER BY updated_at DESC
                LIMIT 1
            ) pp ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    oi.product_size_id,
                    COALESCE(oi.snapshot_product_name, p.product_name) AS product_name,
                    COALESCE(oi.snapshot_size_name, s.size_name) AS size_name,
                    COALESCE(
                        oi.snapshot_image_url,
                        (
                            SELECT pi.image_url
                            FROM product_images pi
                            WHERE pi.product_id = p.id
                            ORDER BY pi.id ASC
                            LIMIT 1
                        )
                    ) AS image_url,
                    oi.quantity,
                    (oi.quantity * oi.price) AS item_total
                FROM order_items oi
                LEFT JOIN product_sizes ps ON oi.product_size_id = ps.id
                LEFT JOIN products p ON ps.product_id = p.id
                LEFT JOIN sizes s ON s.id = ps.size_id
                WHERE oi.order_id = o.id
                ORDER BY oi.id ASC
                LIMIT 1
            ) first_item ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) AS total_items,
                    COALESCE(SUM(quantity), 0) AS total_quantity
                FROM order_items
                WHERE order_id = o.id
            ) item_stat ON TRUE
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
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
        const requesterId = req.user?.id;
        const requesterRole = req.user?.role;

        if (!requesterId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        // Lấy thông tin chung đơn hàng
        const orderQuery = `
            SELECT
                o.*, 
                u.username,
                u.email,
                COALESCE(pp.shipping_info->>'fullName', u.full_name, u.username) AS recipient_name,
                COALESCE(pp.shipping_info->>'phone', u.phone_number) AS recipient_phone,
                COALESCE(pp.shipping_info->>'address', u.address) AS recipient_address,
                COALESCE(pp.payment_method, 'cod') AS payment_method,
                pp.status AS payment_status,
                pp.trans_id AS payment_trans_id
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT payment_method, status, trans_id, shipping_info
                FROM pending_payments
                WHERE order_id = o.id
                ORDER BY updated_at DESC
                LIMIT 1
            ) pp ON TRUE
            WHERE o.id = $1
        `;
        const orderResult = await pool.query(orderQuery, [id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
        }

        const order = orderResult.rows[0];

        const isAdmin = requesterRole === 'admin';
        const isOwner = Number(order.user_id) === Number(requesterId);
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Bạn không có quyền xem đơn hàng này' });
        }

        // Lấy danh sách sản phẩm trong đơn
        const itemsQuery = `
            SELECT
                oi.id,
                oi.order_id,
                oi.product_size_id,
                oi.quantity,
                oi.price,
                COALESCE(oi.snapshot_product_id, p.id) AS product_id,
                COALESCE(oi.snapshot_product_name, p.product_name) AS product_name,
                COALESCE(oi.snapshot_size_name, s.size_name) AS size_name,
                COALESCE(
                    oi.snapshot_image_url,
                    (
                        SELECT pi.image_url
                        FROM product_images pi
                        WHERE pi.product_id = p.id
                        ORDER BY pi.id ASC
                        LIMIT 1
                    )
                ) AS image_url
            FROM order_items oi
            LEFT JOIN product_sizes ps ON oi.product_size_id = ps.id
            LEFT JOIN products p ON ps.product_id = p.id
            LEFT JOIN sizes s ON s.id = ps.size_id
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
