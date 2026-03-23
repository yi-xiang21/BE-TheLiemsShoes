const pool = require('../config/db');

function isAdmin(req) {
    return req.user && req.user.role === 'admin';
}

// Lấy danh sách danh mục
async function getCategories(req, res) {
    try {
        const result = await pool.query('SELECT id, category_name, description FROM categories ORDER BY id DESC');
        return res.status(200).json({ status: 'success', data: result.rows });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Lấy danh mục theo id
async function getCategoryById(req, res) {
    try {
        const categoryId = req.params.id;
        const result = await pool.query('SELECT id, category_name, description FROM categories WHERE id = $1', [categoryId]);

        if (!result.rows.length) {
            return res.status(404).json({ status: 'error', message: 'Category not found' });
        }

        return res.status(200).json({ status: 'success', data: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Lấy sản phẩm theo danh mục
async function getProductByCategory(req, res) {
    try {
        const categoryId = Number(req.params.id);
    const result = await pool.query(`
            SELECT * FROM products
            WHERE product_type_id = $1
        `, [productTypeId]);
        return res.status(200).json({ status: 'success', data: result.rows });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Thêm danh mục
async function addCategory(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }

        const { category_name, description } = req.body;

        if (!category_name || !category_name.trim()) {
            return res.status(400).json({ status: 'error', message: 'Category name is required' });
        }

        const result = await pool.query(
            'INSERT INTO categories (category_name, description) VALUES ($1, $2) RETURNING id',
            [category_name.trim(), description ? description.trim() : null]
        );

        return res.status(201).json({
            status: 'success',
            message: 'Category added successfully',
            data: result.rows[0].id
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Sửa danh mục
async function updateCategory(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }

        const categoryId = req.params.id;
        const { category_name, description } = req.body;

        if (!category_name || !category_name.trim()) {
            return res.status(400).json({ status: 'error', message: 'Category name is required' });
        }

        const check = await pool.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
        if (!check.rows.length) {
            return res.status(404).json({ status: 'error', message: 'Category not found' });
        }

        await pool.query(
            'UPDATE categories SET category_name = $1, description = $2 WHERE id = $3',
            [category_name.trim(), description ? description.trim() : null, categoryId]
        );

        return res.status(200).json({ status: 'success', message: 'Category updated successfully' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Xóa danh mục
async function deleteCategory(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }

        const categoryId = req.params.id;
        const check = await pool.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
        if (!check.rows.length) {
            return res.status(404).json({ status: 'error', message: 'Category not found' });
        }

        await pool.query('DELETE FROM categories WHERE id = $1', [categoryId]);
        return res.status(200).json({ status: 'success', message: 'Category deleted successfully' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

module.exports = {
    getCategories,
    getCategoryById,
    addCategory,
    updateCategory,
    deleteCategory,
    getProductByCategory
};
