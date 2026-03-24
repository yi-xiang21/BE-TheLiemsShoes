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

function toNonNegativeInt(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }

    return Math.floor(parsed);
}

function parseSizeStocks(rawValue) {
    if (rawValue === undefined || rawValue === null) {
        return null;
    }

    let value = rawValue;

    if (typeof rawValue === 'string') {
        try {
            value = JSON.parse(rawValue);
        } catch (_error) {
            return null;
        }
    }

    if (!Array.isArray(value)) {
        return null;
    }

    return value
        .map((item) => ({
            size_id: item?.size_id !== undefined && item?.size_id !== null ? Number(item.size_id) : null,
            size_name: item?.size_name ? String(item.size_name).trim() : null,
            stock_quantity: toNonNegativeInt(item?.stock_quantity, 0)
        }))
        .filter((item) => (Number.isInteger(item.size_id) && item.size_id > 0) || (item.size_name && item.size_name.length > 0));
}

async function resolveSizeId(client, sizeId, sizeName) {
    if (Number.isInteger(sizeId) && sizeId > 0) {
        const sizeResult = await client.query('SELECT id FROM sizes WHERE id = $1', [sizeId]);
        if (!sizeResult.rows.length) {
            throw new Error(`Size with id ${sizeId} not found`);
        }

        return sizeId;
    }

    const normalizedSizeName = String(sizeName || '').trim();
    if (!normalizedSizeName) {
        throw new Error('Size identifier is required');
    }

    const upsertResult = await client.query(
        `INSERT INTO sizes (size_name)
         VALUES ($1)
         ON CONFLICT (size_name)
         DO UPDATE SET size_name = EXCLUDED.size_name
         RETURNING id`,
        [normalizedSizeName]
    );

    return upsertResult.rows[0].id;
}

async function upsertProductSizes(client, productId, sizeStocks) {
    await client.query('DELETE FROM product_sizes WHERE product_id = $1', [productId]);

    const mergedBySizeId = new Map();
    for (const item of sizeStocks) {
        const resolvedSizeId = await resolveSizeId(client, item.size_id, item.size_name);
        const currentStock = mergedBySizeId.get(resolvedSizeId) || 0;
        mergedBySizeId.set(resolvedSizeId, currentStock + toNonNegativeInt(item.stock_quantity, 0));
    }

    for (const [resolvedSizeId, stockQuantity] of mergedBySizeId.entries()) {
        await client.query(
            `INSERT INTO product_sizes (product_id, size_id, stock_quantity)
             VALUES ($1, $2, $3)`,
            [productId, resolvedSizeId, stockQuantity]
        );
    }
}

// Thêm sản phẩm
async function addProduct(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }
        const { product_name, price, description, category_id, product_type_id, stock_quantity } = req.body;
        if (!product_name || !price || !description || !category_id) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const parsedSizeStocks = parseSizeStocks(req.body.size_stocks || req.body.product_sizes);

        const fallbackStock = toNonNegativeInt(stock_quantity, 0);
        const effectiveSizeStocks = parsedSizeStocks && parsedSizeStocks.length
            ? parsedSizeStocks
            : [{ size_name: '40', stock_quantity: fallbackStock }];

        await pool.query('BEGIN');

        const result = await pool.query(
            `INSERT INTO products (category_id, product_type_id, product_name, description, price)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [category_id, product_type_id || null, product_name.trim(), description.trim(), price]
        );

        const productId = result.rows[0].id;

        await upsertProductSizes(pool, productId, effectiveSizeStocks);

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
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }
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

        const parsedSizeStocks = parseSizeStocks(req.body.size_stocks || req.body.product_sizes);
        const shouldUpdateSizeStocks = Boolean(parsedSizeStocks);

        await pool.query('BEGIN');

        await pool.query(
            `UPDATE products
             SET category_id = $1,
                 product_type_id = $2,
                 product_name = $3,
                 description = $4,
                 price = $5
             WHERE id = $6`,
            [category_id, product_type_id || null, product_name.trim(), description.trim(), price, productId]
        );

        if (shouldUpdateSizeStocks) {
            await upsertProductSizes(pool, productId, parsedSizeStocks);
        } else if (stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== '') {
            const defaultSizeId = await resolveSizeId(pool, null, '40');
            const normalizedStock = toNonNegativeInt(stock_quantity, 0);
            await pool.query(
                `INSERT INTO product_sizes (product_id, size_id, stock_quantity)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (product_id, size_id)
                 DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity`,
                [productId, defaultSizeId, normalizedStock]
            );
        }
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
        if (!isAdmin(req)) {
            return res.status(403).json({ status: 'error', message: 'Access denied' });
        }
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
                pt.type_name AS product_type_name,
                COALESCE(stock.total_stock, 0) AS stock_quantity,
                COALESCE(img.images, '[]'::json) AS images,
                COALESCE(sz.sizes, '[]'::json) AS sizes
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_type pt ON p.product_type_id = pt.id
            LEFT JOIN LATERAL (
                SELECT SUM(ps.stock_quantity)::int AS total_stock
                FROM product_sizes ps
                WHERE ps.product_id = p.id
            ) stock ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object('id', pi.id, 'image_url', pi.image_url)
                    ORDER BY pi.id
                ) AS images
                FROM product_images pi
                WHERE pi.product_id = p.id
            ) img ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'product_size_id', ps.id,
                        'size_id', s.id,
                        'size_name', s.size_name,
                        'stock_quantity', ps.stock_quantity
                    )
                    ORDER BY s.id
                ) AS sizes
                FROM product_sizes ps
                JOIN sizes s ON s.id = ps.size_id
                WHERE ps.product_id = p.id
            ) sz ON true
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
                pt.type_name AS product_type_name,
                COALESCE(stock.total_stock, 0) AS stock_quantity,
                COALESCE(img.images, '[]'::json) AS images,
                COALESCE(sz.sizes, '[]'::json) AS sizes
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_type pt ON p.product_type_id = pt.id
            LEFT JOIN LATERAL (
                SELECT SUM(ps.stock_quantity)::int AS total_stock
                FROM product_sizes ps
                WHERE ps.product_id = p.id
            ) stock ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object('id', pi.id, 'image_url', pi.image_url)
                    ORDER BY pi.id
                ) AS images
                FROM product_images pi
                WHERE pi.product_id = p.id
            ) img ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'product_size_id', ps.id,
                        'size_id', s.id,
                        'size_name', s.size_name,
                        'stock_quantity', ps.stock_quantity
                    )
                    ORDER BY s.id
                ) AS sizes
                FROM product_sizes ps
                JOIN sizes s ON s.id = ps.size_id
                WHERE ps.product_id = p.id
            ) sz ON true
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

// Quản lý tồn kho (update stock)
async function updateStock(req, res) {
    try {

        const productId = req.params.id;
        const { stock_quantity, product_size_id, size_id, size_name } = req.body;

        if (stock_quantity === undefined || stock_quantity === null || stock_quantity === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Stock quantity is required'
            });
        }

        const normalizedStock = toNonNegativeInt(stock_quantity, -1);
        if (normalizedStock < 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Stock quantity must be a non-negative integer'
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

        if (product_size_id) {
            const updated = await pool.query(
                `UPDATE product_sizes
                 SET stock_quantity = $1
                 WHERE id = $2 AND product_id = $3
                 RETURNING id, product_id, size_id, stock_quantity`,
                [normalizedStock, product_size_id, productId]
            );

            if (!updated.rows.length) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Product size not found'
                });
            }

            return res.status(200).json({
                status: 'success',
                message: 'Stock updated successfully',
                data: updated.rows[0]
            });
        }

        const resolvedSizeId = await resolveSizeId(
            pool,
            Number.isInteger(Number(size_id)) ? Number(size_id) : null,
            size_name || '40'
        );

        const upserted = await pool.query(
            `INSERT INTO product_sizes (product_id, size_id, stock_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, size_id)
             DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity
             RETURNING id, product_id, size_id, stock_quantity`,
            [productId, resolvedSizeId, normalizedStock]
        );

        return res.status(200).json({
            status: 'success',
            message: 'Stock updated successfully',
            data: upserted.rows[0]
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

// Lấy sản phẩm theo loại
async function getProductsByType(req, res) {
    try {
        const productTypeId = Number(req.params.type);

        if (!Number.isInteger(productTypeId) || productTypeId <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid product type id'
            });
        }

        const result = await pool.query(`
            SELECT
                p.*,
                c.category_name,
                pt.type_name AS product_type_name,
                COALESCE(stock.total_stock, 0) AS stock_quantity,
                COALESCE(img.images, '[]'::json) AS images,
                COALESCE(sz.sizes, '[]'::json) AS sizes
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_type pt ON p.product_type_id = pt.id
            LEFT JOIN LATERAL (
                SELECT SUM(ps.stock_quantity)::int AS total_stock
                FROM product_sizes ps
                WHERE ps.product_id = p.id
            ) stock ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object('id', pi.id, 'image_url', pi.image_url)
                    ORDER BY pi.id
                ) AS images
                FROM product_images pi
                WHERE pi.product_id = p.id
            ) img ON true
            LEFT JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                        'product_size_id', ps.id,
                        'size_id', s.id,
                        'size_name', s.size_name,
                        'stock_quantity', ps.stock_quantity
                    )
                    ORDER BY s.id
                ) AS sizes
                FROM product_sizes ps
                JOIN sizes s ON s.id = ps.size_id
                WHERE ps.product_id = p.id
            ) sz ON true
            WHERE p.product_type_id = $1
            ORDER BY p.id DESC
        `, [productTypeId]);

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
    getProductTypes,
    getProductsByType
}