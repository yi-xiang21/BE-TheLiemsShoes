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
        const { name, price, description, category_id, stock_quantity } = req.body;
        if (!name || !price || !description || !category_id || !stock_quantity) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }
        const [result] = await pool.execute(`INSERT INTO products (category_id, name, description, price, stock_quantity) VALUES (?, ?, ?, ?, ?)`, [category_id, name.trim(), description.trim(), price, stock_quantity]);
        return res.status(201).json({ status: 'success', message: 'Product added successfully', data: result.insertId });
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
        const { name, price, description, category_id, stock_quantity } = req.body;
        // Kiểm tra xem sản phẩm có tồn tại hay không
        const [rows] = await pool.execute(`SELECT * FROM products WHERE id = ?`, [productId]);
        if (!rows.length) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }
        await pool.execute(`UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, stock_quantity = ? WHERE id = ?`, [category_id, name.trim(), description.trim(), price, stock_quantity, productId]);
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
        const [rows] = await pool.execute(`SELECT * FROM products WHERE id = ?`, [productId]);
        if (!rows.length) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }
        await pool.execute(`DELETE FROM products WHERE id = ?`, [productId]);
        return res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

module.exports = {
    addProduct,
    updateProduct,
    deleteProduct
}