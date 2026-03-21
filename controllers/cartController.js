const pool = require('../config/db');

const getCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Vui lòng đăng nhập.' });
        }
        const cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
        if (cartResult.rows.length === 0) {
            return res.status(200).json({ 
                cartId: null,
                cartItems: [], 
                total: 0 
            });
        }
        const cartId = cartResult.rows[0].id;
        const query = `
            SELECT 
                ci.id as cart_item_id,
                ci.product_id,
                ci.quantity,
                p.product_name,
                p.price,
                p.stock_quantity,
                (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) as image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = $1
            ORDER BY ci.id ASC
        `;
        const itemsResult = await pool.query(query, [cartId]);
        // Tính tổng tiền
        const total = itemsResult.rows.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

        res.json({
            cartId,
            cartItems: itemsResult.rows,
            total
        });

    } catch (error) {
        console.error('Lỗi khi lấy giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy giỏ hàng' });
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { productId, quantity } = req.body;
        const qty = parseInt(quantity) || 1;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        // 1. Kiểm tra hoặc tạo giỏ hàng cho user
        let cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
        let cartId;

        if (cartResult.rows.length === 0) {
            const newCart = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
            cartId = newCart.rows[0].id;
        } else {
            cartId = cartResult.rows[0].id;
        }

        // 2. Kiểm tra sản phẩm có tồn tại không
        const productCheck = await pool.query('SELECT id, stock_quantity FROM products WHERE id = $1', [productId]);
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
        }

        // Có thể check thêm stock_quantity ở đây nếu cần

        // 3. Upsert vào cart_items
        // Kiểm tra xem sản phẩm đã có trong giỏ chưa
        const itemCheck = await pool.query(
            'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
            [cartId, productId]
        );

        if (itemCheck.rows.length > 0) {
            // Cập nhật số lượng: cũ + mới
            const newQuantity = itemCheck.rows[0].quantity + qty;
            await pool.query(
                'UPDATE cart_items SET quantity = $1 WHERE id = $2',
                [newQuantity, itemCheck.rows[0].id]
            );
        } else {
            // Thêm mới
            await pool.query(
                'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
                [cartId, productId, qty]
            );
        }

        res.status(200).json({ message: 'Đã thêm sản phẩm vào giỏ hàng' });

    } catch (error) {
        console.error('Lỗi khi thêm vào giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi server khi thêm vào giỏ hàng' });
    }
};

const updateCartItem = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { itemId } = req.params; // Đây là id của cart_items
        const { quantity } = req.body;
        const qty = parseInt(quantity);

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        if (isNaN(qty) || qty <= 0) {
             return res.status(400).json({ message: 'Số lượng không hợp lệ' });
        }

        // Kiểm tra item có thuộc giỏ hàng của user này không (Authorization check)
        const checkQuery = `
            SELECT ci.id 
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            WHERE ci.id = $1 AND c.user_id = $2
        `;
        const checkResult = await pool.query(checkQuery, [itemId, userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Mục giỏ hàng không tìm thấy hoặc không thuộc về bạn' });
        }

        // Cập nhật
        await pool.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [qty, itemId]);

        res.json({ message: 'Cập nhật số lượng thành công' });

    } catch (error) {
        console.error('Lỗi cập nhật giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

const removeCartItem = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { itemId } = req.params;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const result = await pool.query(`
            DELETE FROM cart_items 
            WHERE id = $1 AND cart_id IN (SELECT id FROM carts WHERE user_id = $2)
            RETURNING id
        `, [itemId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Item không tìm thấy hoặc không thể xóa' });
        }

        res.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng' });

    } catch (error) {
        console.error('Lỗi xóa khỏi giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

const clearCart = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        await pool.query(`
            DELETE FROM cart_items 
            WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)
        `, [userId]);

        res.json({ message: 'Đã xóa toàn bộ giỏ hàng' });
    } catch (error) {
        console.error('Lỗi xóa giỏ hàng:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart
};
