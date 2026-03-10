const pool = require('../config/db');
const bcrypt = require('bcrypt');

function isAdmin(req) {
    return req.user && req.user.role === 'admin';
}

// Thêm sản phẩm
async function addProduct(req, res) {
    try {
        // if (!isAdmin(req)) {
        //     return res.status(403).json({ status: 'error', message: 'Access denied' });
        // }
        const { product_name, price, description, category_id, stock_quantity } = req.body;
        if (!product_name || !price || !description || !category_id || !stock_quantity) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }
        const result = await pool.query(`INSERT INTO products (category_id, product_name, description, price, stock_quantity) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [category_id, product_name.trim(), description.trim(), price, stock_quantity]);
        return res.status(201).json({ status: 'success', message: 'Product added successfully', data: result.rows[0].id });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Sửa sản phẩm
async function updateProduct(req, res) {
    try {
        // if (!isAdmin(req)) {
        //     return res.status(403).json({ status: 'error', message: 'Access denied' });
        // }
        const productId = req.params.id;
        const { product_name, price, description, category_id, stock_quantity } = req.body;
        // Kiểm tra xem sản phẩm có tồn tại hay không
        const check = await pool.query(`SELECT * FROM products WHERE id = $1`, [productId]);
        if (!check.rows.length) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }
        await pool.query(`UPDATE products SET category_id = $1, product_name = $2, description = $3, price = $4, stock_quantity = $5 WHERE id = $6`, [category_id, product_name.trim(), description.trim(), price, stock_quantity, productId]);
        return res.status(200).json({ status: 'success', message: 'Product updated successfully' });
    }
    catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Xóa sản phẩm
async function deleteProduct(req, res) {
    try {
        // if (!isAdmin(req)) {
        //     return res.status(403).json({ status: 'error', message: 'Access denied' });
        // }
        const productId = req.params.id;
        const check = await pool.query(`SELECT * FROM products WHERE id = $1`, [productId]);
        if (!check.rows.length) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }
        await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
        return res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// lấy danh sách sản phẩm
async function getProducts(req, res) {
    try {
        const result = await pool.query(`
            SELECT p.*, c.category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
        `);

        return res.status(200).json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
}

// lấy chi tiết sản phẩm
async function getProductById(req, res) {
    try {
        const productId = req.params.id;

        const result = await pool.query(`
            SELECT p.*, c.category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1
        `, [productId]);

        if (!result.rows.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });

    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
}

// quản lý tồn kho (update stock)
async function updateStock(req, res) {
    try {

        const productId = req.params.id;
        const { stock_quantity } = req.body;

        if (!stock_quantity) {
            return res.status(400).json({
                status: 'error',
                message: 'Stock quantity is required'
            });
        }

        const check = await pool.query(
            `SELECT * FROM products WHERE id = $1`,
            [productId]
        );

        if (!check.rows.length) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        await pool.query(
            `UPDATE products SET stock_quantity = $1 WHERE id = $2`,
            [stock_quantity, productId]
        );

        return res.status(200).json({
            status: 'success',
            message: 'Stock updated successfully'
        });

    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
}

module.exports = {
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById,
    updateStock
}