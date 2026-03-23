const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp'
};

function normalizeUploadFileName(originalName, mimeType) {
    const rawName = (originalName || 'image').trim();
    const detectedExt = path.extname(rawName).toLowerCase();
    let baseName = path.basename(rawName, detectedExt);

    if (detectedExt) {
        const escapedExt = detectedExt.replace('.', '\\.') ;
        const trailingExtRegex = new RegExp(`(${escapedExt})+$`, 'i');
        baseName = baseName.replace(trailingExtRegex, '');
    }

    const cleanBaseName = baseName
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'image';

    return {
        baseName: cleanBaseName,
        ext: detectedExt || mimeToExt[mimeType] || ''
    };
}

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const { baseName, ext } = normalizeUploadFileName(file.originalname, file.mimetype);
        cb(null, `${Date.now()}-${baseName}${ext}`);
    }
});

const imageUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            return cb(null, true);
        }

        return cb(new Error('Only image files are allowed.'));
    }
});

const uploadProductImages = imageUpload.array('images', 10);

function isAdmin(req) {
    return req.user && req.user.role === 'admin';
}

// Thêm sản phẩm
async function addProduct(req, res) {
    try {
        // if (!isAdmin(req)) {
        //     return res.status(403).json({ status: 'error', message: 'Access denied' });
        // }
        const { product_name, price, description, category_id, product_type_id, stock_quantity } = req.body;
        if (!product_name || !price || !description || !category_id) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const normalizedStock = stock_quantity === undefined || stock_quantity === null || stock_quantity === ''
            ? 0
            : Number(stock_quantity);

        await pool.query('BEGIN');

        const result = await pool.query(
            `INSERT INTO products (category_id, product_type_id, product_name, description, price, stock_quantity)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [category_id, product_type_id || null, product_name.trim(), description.trim(), price, normalizedStock]
        );

        const productId = result.rows[0].id;
        const files = Array.isArray(req.files) ? req.files : [];

        for (const file of files) {
            const imageUrl = `/uploads/${file.filename}`;
            await pool.query(
                `INSERT INTO product_images (product_id, image_url) VALUES ($1, $2)`,
                [productId, imageUrl]
            );
        }

        await pool.query('COMMIT');

        return res.status(201).json({
            status: 'success',
            message: 'Product added successfully',
            data: {
                id: productId,
                images: files.map((file) => `/uploads/${file.filename}`)
            }
        });
    } catch (error) {
        try {
            await pool.query('ROLLBACK');
        } catch (_rollbackError) {
            // Ignore rollback errors and return original failure.
        }

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
        const { product_name, price, description, category_id, product_type_id, stock_quantity } = req.body;
        // Kiểm tra xem sản phẩm có tồn tại hay không
        const check = await pool.query(`SELECT * FROM products WHERE id = $1`, [productId]);
        if (!check.rows.length) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }

        if (!product_name || !price || !description || !category_id) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const normalizedStock = stock_quantity === undefined || stock_quantity === null || stock_quantity === ''
            ? 0
            : Number(stock_quantity);

        await pool.query('BEGIN');

        await pool.query(
            `UPDATE products
             SET category_id = $1,
                 product_type_id = $2,
                 product_name = $3,
                 description = $4,
                 price = $5,
                 stock_quantity = $6
             WHERE id = $7`,
            [category_id, product_type_id || null, product_name.trim(), description.trim(), price, normalizedStock, productId]
        );
        // Cập nhật hình ảnh: Xử lý xóa hình ảnh cũ không còn trong danh sách mới và thêm hình ảnh mới
        const rawImageUrls = req.body.image_urls;
        if (rawImageUrls !== undefined) {
            let submittedImageUrls = [];

            if (Array.isArray(rawImageUrls)) {
                submittedImageUrls = rawImageUrls;
            } else if (typeof rawImageUrls === 'string') {
                try {
                    const parsed = JSON.parse(rawImageUrls);
                    submittedImageUrls = Array.isArray(parsed) ? parsed : [];
                } catch (_parseError) {
                    submittedImageUrls = [];
                }
            }

            const normalizedSubmittedUrls = submittedImageUrls
                .map((url) => String(url || '').trim())
                .filter(Boolean);

            const currentImageRows = await pool.query(
                `SELECT id, image_url FROM product_images WHERE product_id = $1`,
                [productId]
            );

            const submittedSet = new Set(normalizedSubmittedUrls);

            for (const imageRow of currentImageRows.rows) {
                if (!submittedSet.has(imageRow.image_url)) {
                    await pool.query(
                        `DELETE FROM product_images WHERE id = $1 AND product_id = $2`,
                        [imageRow.id, productId]
                    );

                    if (String(imageRow.image_url || '').startsWith('/uploads/')) {
                        const fileName = path.basename(imageRow.image_url);
                        const filePath = path.join(uploadDir, fileName);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                }
            }

            const currentUrlSet = new Set(currentImageRows.rows.map((row) => row.image_url));
            for (const imageUrl of normalizedSubmittedUrls) {
                if (!currentUrlSet.has(imageUrl)) {
                    await pool.query(
                        `INSERT INTO product_images (product_id, image_url) VALUES ($1, $2)`,
                        [productId, imageUrl]
                    );
                }
            }
        }
        // Kết thúc cập nhật hình ảnh

        const files = Array.isArray(req.files) ? req.files : [];
        for (const file of files) {
            const imageUrl = `/uploads/${file.filename}`;
            await pool.query(
                `INSERT INTO product_images (product_id, image_url) VALUES ($1, $2)`,
                [productId, imageUrl]
            );
        }

        await pool.query('COMMIT');

        return res.status(200).json({ status: 'success', message: 'Product updated successfully' });
    }
    catch (error) {
        try {
            await pool.query('ROLLBACK');
        } catch (_rollbackError) {
            // Ignore rollback errors and return original failure.
        }

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

        const imageRows = await pool.query(`SELECT image_url FROM product_images WHERE product_id = $1`, [productId]);
        for (const row of imageRows.rows) {
            if (!row.image_url) {
                continue;
            }

            const fileName = path.basename(row.image_url);
            const filePath = path.join(uploadDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
        return res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Lấy danh sách sản phẩm
async function getProducts(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                p.*,
                c.category_name,
                COALESCE(
                    json_agg(
                        json_build_object('id', pi.id, 'image_url', pi.image_url)
                        ORDER BY pi.id
                    ) FILTER (WHERE pi.id IS NOT NULL),
                    '[]'::json
                ) AS images
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_images pi ON pi.product_id = p.id
            GROUP BY p.id, c.category_name
            ORDER BY p.id DESC
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

// Lấy chi tiết sản phẩm
async function getProductById(req, res) {
    try {
        const productId = req.params.id;

        const result = await pool.query(`
            SELECT
                p.*,
                c.category_name,
                COALESCE(
                    json_agg(
                        json_build_object('id', pi.id, 'image_url', pi.image_url)
                        ORDER BY pi.id
                    ) FILTER (WHERE pi.id IS NOT NULL),
                    '[]'::json
                ) AS images
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_images pi ON pi.product_id = p.id
            WHERE p.id = $1
            GROUP BY p.id, c.category_name
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

// Quản lý tồn kho (update stock)
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

// Lấy danh sách loại sản phẩm
async function getProductTypes(req, res) {
    try {
        const result = await pool.query(
            `SELECT * FROM product_type ORDER BY id ASC`
        );

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

module.exports = {
    uploadProductImages,
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById,
    updateStock,
    getProductTypes
}