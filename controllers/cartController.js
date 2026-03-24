const pool = require('../config/db');

function parsePositiveInt(value, fallback = null) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
}

async function resolveProductSizeId(productSizeId, productId, sizeId, sizeName) {
    if (parsePositiveInt(productSizeId)) {
        return parsePositiveInt(productSizeId);
    }

    const parsedProductId = parsePositiveInt(productId);
    if (!parsedProductId) {
        return null;
    }

    if (parsePositiveInt(sizeId)) {
        const result = await pool.query(
            'SELECT id FROM product_sizes WHERE product_id = $1 AND size_id = $2',
            [parsedProductId, parsePositiveInt(sizeId)]
        );
        return result.rows[0]?.id || null;
    }

    const normalizedSizeName = String(sizeName || '').trim();
    if (!normalizedSizeName) {
        return null;
    }

    const result = await pool.query(
        `SELECT ps.id
         FROM product_sizes ps
         JOIN sizes s ON s.id = ps.size_id
         WHERE ps.product_id = $1 AND s.size_name = $2`,
        [parsedProductId, normalizedSizeName]
    );

    return result.rows[0]?.id || null;
}

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
                p.id AS product_id,
                ci.product_size_id,
                s.id AS size_id,
                s.size_name,
                ci.quantity,
                p.product_name,
                p.price,
                ps.stock_quantity,
                (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) as image_url
            FROM cart_items ci
            JOIN product_sizes ps ON ci.product_size_id = ps.id
            JOIN products p ON ps.product_id = p.id
            JOIN sizes s ON ps.size_id = s.id
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
        const {
            productId,
            product_size_id,
            productSizeId,
            size_id,
            sizeId,
            size_name,
            sizeName,
            quantity
        } = req.body;
        const qty = parsePositiveInt(quantity, 1);

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!qty) {
            return res.status(400).json({ message: 'Quantity không hợp lệ' });
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

        // 2. Resolve biến thể sản phẩm theo size
        const resolvedProductSizeId = await resolveProductSizeId(
            product_size_id || productSizeId,
            productId,
            size_id || sizeId,
            size_name || sizeName
        );

        if (!resolvedProductSizeId) {
            return res.status(400).json({ message: 'Thiếu hoặc sai size sản phẩm' });
        }

        const variantCheck = await pool.query(
            `SELECT ps.id, ps.stock_quantity
             FROM product_sizes ps
             WHERE ps.id = $1`,
            [resolvedProductSizeId]
        );

        if (!variantCheck.rows.length) {
            return res.status(404).json({ message: 'Biến thể sản phẩm không tồn tại' });
        }

        // 3. Upsert vào cart_items
        // Kiểm tra xem biến thể đã có trong giỏ chưa
        const itemCheck = await pool.query(
            'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_size_id = $2',
            [cartId, resolvedProductSizeId]
        );

        const existingQty = itemCheck.rows.length ? Number(itemCheck.rows[0].quantity) : 0;
        const newQuantity = existingQty + qty;

        if (newQuantity > Number(variantCheck.rows[0].stock_quantity)) {
            return res.status(400).json({
                message: `Số lượng vượt tồn kho. Tồn khả dụng: ${variantCheck.rows[0].stock_quantity}`
            });
        }

        if (itemCheck.rows.length > 0) {
            await pool.query(
                'UPDATE cart_items SET quantity = $1 WHERE id = $2',
                [newQuantity, itemCheck.rows[0].id]
            );
        } else {
            await pool.query(
                'INSERT INTO cart_items (cart_id, product_size_id, quantity) VALUES ($1, $2, $3)',
                [cartId, resolvedProductSizeId, qty]
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
            SELECT ci.id, ps.stock_quantity
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            JOIN product_sizes ps ON ci.product_size_id = ps.id
            WHERE ci.id = $1 AND c.user_id = $2
        `;
        const checkResult = await pool.query(checkQuery, [itemId, userId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Mục giỏ hàng không tìm thấy hoặc không thuộc về bạn' });
        }

        const availableStock = Number(checkResult.rows[0].stock_quantity);
        if (qty > availableStock) {
            return res.status(400).json({
                message: `Số lượng vượt tồn kho. Tồn khả dụng: ${availableStock}`
            });
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
