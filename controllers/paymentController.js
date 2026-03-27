const crypto = require('crypto');
const pool = require('../config/db');

let ensurePendingPaymentsTablePromise;

const MOMO_CONFIG = {
	partnerCode: process.env.MOMO_PARTNER_CODE,
	accessKey: process.env.MOMO_ACCESS_KEY,
	secretKey: process.env.MOMO_SECRET_KEY,
	redirectUrl: process.env.MOMO_REDIRECT_URL,
	ipnUrl: process.env.MOMO_IPN_URL,
	apiEndpoint: process.env.MOMO_API_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create'
};

const ORDER_FROM_CART_QUERY = `
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

const ensurePendingPaymentsTable = async () => {
	if (!ensurePendingPaymentsTablePromise) {
		ensurePendingPaymentsTablePromise = pool.query(`
			CREATE TABLE IF NOT EXISTS pending_payments (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
				cart_snapshot JSONB NOT NULL,
				total_amount DECIMAL(10,2) NOT NULL,
				shipping_info JSONB,
				payment_method VARCHAR(20) NOT NULL DEFAULT 'momo',
				request_id VARCHAR(120) NOT NULL UNIQUE,
				momo_order_id VARCHAR(120) NOT NULL UNIQUE,
				status VARCHAR(20) NOT NULL DEFAULT 'pending',
				result_code VARCHAR(30),
				message TEXT,
				trans_id VARCHAR(120),
				order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
				expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				CHECK (status IN ('pending', 'success', 'failed', 'expired'))
			)
		`);
	}

	return ensurePendingPaymentsTablePromise;
};

const normalizeMomoValue = (value) => {
	if (value === null || value === undefined) return '';
	return String(value);
};

const createMomoHmac = (rawSignature) => {
	return crypto
		.createHmac('sha256', MOMO_CONFIG.secretKey)
		.update(rawSignature)
		.digest('hex');
};

const buildCreateSignatureRaw = ({ amount, extraData, orderId, orderInfo, requestId }) => {
	return [
		`accessKey=${normalizeMomoValue(MOMO_CONFIG.accessKey)}`,
		`amount=${normalizeMomoValue(amount)}`,
		`extraData=${normalizeMomoValue(extraData)}`,
		`ipnUrl=${normalizeMomoValue(MOMO_CONFIG.ipnUrl)}`,
		`orderId=${normalizeMomoValue(orderId)}`,
		`orderInfo=${normalizeMomoValue(orderInfo)}`,
		`partnerCode=${normalizeMomoValue(MOMO_CONFIG.partnerCode)}`,
		`redirectUrl=${normalizeMomoValue(MOMO_CONFIG.redirectUrl)}`,
		`requestId=${normalizeMomoValue(requestId)}`,
		'requestType=captureWallet'
	].join('&');
};

const buildResultSignatureRaw = (payload = {}) => {
	const fieldsInOrder = [
		'accessKey',
		'amount',
		'extraData',
		'message',
		'orderId',
		'orderInfo',
		'orderType',
		'partnerCode',
		'payType',
		'requestId',
		'responseTime',
		'resultCode',
		'transId'
	];

	return fieldsInOrder
		.filter((field) => payload[field] !== undefined && payload[field] !== null)
		.map((field) => `${field}=${normalizeMomoValue(payload[field])}`)
		.join('&');
};

const isValidMomoResultSignature = (payload = {}) => {
	if (!payload.signature || !MOMO_CONFIG.secretKey) {
		return false;
	}

	const rawSignature = buildResultSignatureRaw(payload);
	if (!rawSignature) {
		return false;
	}

	const expectedSignature = createMomoHmac(rawSignature);
	return expectedSignature === payload.signature;
};

const mapCartRowsToSnapshot = (rows) => {
	return rows.map((row) => ({
		product_size_id: row.product_size_id,
		product_id: row.product_id,
		product_name: row.product_name,
		size_name: row.size_name,
		image_url: row.image_url,
		price: Number(row.price),
		quantity: Number(row.quantity)
	}));
};

const computeSnapshotTotal = (snapshot = []) => {
	return snapshot.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
};

const hasValidMomoConfig = () => {
	return Boolean(
		MOMO_CONFIG.partnerCode &&
		MOMO_CONFIG.accessKey &&
		MOMO_CONFIG.secretKey &&
		MOMO_CONFIG.redirectUrl &&
		MOMO_CONFIG.ipnUrl &&
		MOMO_CONFIG.apiEndpoint
	);
};

const createMomoPayment = async (req, res) => {
	const userId = req.user?.id;
	if (!userId) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	if (!hasValidMomoConfig()) {
		return res.status(500).json({ message: 'MoMo configuration is missing in environment variables.' });
	}

	const { fullName, phone, address, email } = req.body || {};

	if (!fullName || !phone || !address || !email) {
		return res.status(400).json({ message: 'Missing recipient information.' });
	}

	const client = await pool.connect();
	let pendingPaymentId;

	try {
		await ensurePendingPaymentsTable();
		await client.query('BEGIN');

		const cartResult = await client.query(ORDER_FROM_CART_QUERY, [userId]);
		if (!cartResult.rows.length) {
			await client.query('ROLLBACK');
			return res.status(400).json({ message: 'Giỏ hàng trống!' });
		}

		const snapshot = mapCartRowsToSnapshot(cartResult.rows);
		const cartId = cartResult.rows[0].cart_id;
		const totalAmount = computeSnapshotTotal(snapshot);

		if (totalAmount <= 0) {
			await client.query('ROLLBACK');
			return res.status(400).json({ message: 'Giỏ hàng không hợp lệ.' });
		}

		const timestamp = Date.now();
		const requestId = `REQ_${userId}_${timestamp}`;
		const momoOrderId = `MOMO_${userId}_${timestamp}`;

		const pendingInsertResult = await client.query(
			`
				INSERT INTO pending_payments (
					user_id,
					cart_id,
					cart_snapshot,
					total_amount,
					shipping_info,
					payment_method,
					request_id,
					momo_order_id,
					status
				) VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, 'momo', $6, $7, 'pending')
				RETURNING id
			`,
			[
				userId,
				cartId,
				JSON.stringify(snapshot),
				totalAmount,
				JSON.stringify({ fullName, phone, address, email }),
				requestId,
				momoOrderId
			]
		);
		pendingPaymentId = pendingInsertResult.rows[0].id;

		await client.query('COMMIT');

		const orderInfo = `Thanh toan don hang TheLiemsShoes #${pendingPaymentId}`;
		const extraData = Buffer.from(JSON.stringify({ pendingPaymentId, userId })).toString('base64');
		const signature = createMomoHmac(
			buildCreateSignatureRaw({
				amount: totalAmount,
				extraData,
				orderId: momoOrderId,
				orderInfo,
				requestId
			})
		);

		const momoPayload = {
			partnerCode: MOMO_CONFIG.partnerCode,
			accessKey: MOMO_CONFIG.accessKey,
			requestId,
			amount: String(Math.round(totalAmount)),
			orderId: momoOrderId,
			orderInfo,
			redirectUrl: MOMO_CONFIG.redirectUrl,
			ipnUrl: MOMO_CONFIG.ipnUrl,
			extraData,
			requestType: 'captureWallet',
			signature,
			lang: 'vi'
		};

		const momoResponse = await fetch(MOMO_CONFIG.apiEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(momoPayload)
		});

		const momoData = await momoResponse.json();

		if (!momoResponse.ok || Number(momoData.resultCode) !== 0 || !momoData.payUrl) {
			await pool.query(
				`
					UPDATE pending_payments
					SET status = 'failed',
						result_code = $1,
						message = $2,
						updated_at = CURRENT_TIMESTAMP
					WHERE id = $3
				`,
				[String(momoData.resultCode || 'CREATE_FAILED'), momoData.message || 'Failed to create MoMo payment.', pendingPaymentId]
			);
			return res.status(502).json({ message: momoData.message || 'Failed to create MoMo payment.' });
		}

		return res.status(200).json({
			payUrl: momoData.payUrl,
			requestId,
			orderId: momoOrderId,
			pendingPaymentId
		});
	} catch (error) {
		try {
			await client.query('ROLLBACK');
		} catch (rollbackError) {
			console.error('Rollback error in createMomoPayment:', rollbackError);
		}
		console.error('createMomoPayment error:', error);
		return res.status(500).json({ message: 'Lỗi server khi tạo thanh toán MoMo.' });
	} finally {
		client.release();
	}
};

const handleMomoIpn = async (req, res) => {
	try {
		await ensurePendingPaymentsTable();

		const payload = req.body || {};
		const requestId = payload.requestId;

		if (!requestId) {
			return res.status(400).json({ resultCode: 1, message: 'Missing requestId' });
		}

		if (payload.signature && !isValidMomoResultSignature(payload)) {
			return res.status(400).json({ resultCode: 1, message: 'Invalid signature' });
		}

		const resultCode = String(payload.resultCode ?? '1');
		const status = resultCode === '0' ? 'success' : 'failed';

		await pool.query(
			`
				UPDATE pending_payments
				SET status = $1,
					result_code = $2,
					message = $3,
					trans_id = $4,
					updated_at = CURRENT_TIMESTAMP
				WHERE request_id = $5
			`,
			[status, resultCode, payload.message || null, payload.transId || null, requestId]
		);

		return res.status(200).json({ resultCode: 0, message: 'IPN received' });
	} catch (error) {
		console.error('handleMomoIpn error:', error);
		return res.status(500).json({ resultCode: 1, message: 'Server error' });
	}
};

const finalizeMomoOrder = async (req, res) => {
	const userId = req.user?.id;
	if (!userId) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const { requestId, momoPayload } = req.body || {};

	if (!requestId) {
		return res.status(400).json({ message: 'Missing requestId.' });
	}

	const client = await pool.connect();

	try {
		await ensurePendingPaymentsTable();
		await client.query('BEGIN');

		const pendingResult = await client.query(
			'SELECT * FROM pending_payments WHERE request_id = $1 AND user_id = $2 FOR UPDATE',
			[requestId, userId]
		);

		if (!pendingResult.rows.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ message: 'Không tìm thấy phiên thanh toán.' });
		}

		const pending = pendingResult.rows[0];
		const now = new Date();

		if (pending.expires_at && new Date(pending.expires_at) < now && pending.status === 'pending') {
			await client.query(
				`
					UPDATE pending_payments
					SET status = 'expired',
						message = 'Payment session expired.',
						updated_at = CURRENT_TIMESTAMP
					WHERE id = $1
				`,
				[pending.id]
			);
			await client.query('COMMIT');
			return res.status(400).json({ message: 'Phiên thanh toán đã hết hạn.' });
		}

		if (pending.order_id) {
			await client.query('COMMIT');
			return res.status(200).json({
				message: 'Đơn hàng đã được tạo trước đó.',
				orderId: pending.order_id
			});
		}

		const payloadResultCode = momoPayload?.resultCode !== undefined
			? String(momoPayload.resultCode)
			: null;

		if (pending.status !== 'success') {
			if (payloadResultCode === '0') {
				await client.query(
					`
						UPDATE pending_payments
						SET status = 'success',
							result_code = '0',
							message = $1,
							trans_id = $2,
							updated_at = CURRENT_TIMESTAMP
						WHERE id = $3
					`,
					[momoPayload?.message || 'Payment success', momoPayload?.transId || null, pending.id]
				);
				pending.status = 'success';
			} else {
				await client.query('ROLLBACK');
				return res.status(400).json({ message: 'Thanh toán chưa thành công.' });
			}
		}

		const snapshot = Array.isArray(pending.cart_snapshot) ? pending.cart_snapshot : [];
		if (!snapshot.length) {
			await client.query('ROLLBACK');
			return res.status(400).json({ message: 'Giỏ hàng snapshot không hợp lệ.' });
		}

		const productSizeIds = snapshot.map((item) => Number(item.product_size_id)).filter(Boolean);
		const stockResult = await client.query(
			`
				SELECT id, stock_quantity
				FROM product_sizes
				WHERE id = ANY($1::int[])
				FOR UPDATE
			`,
			[productSizeIds]
		);

		const stockMap = new Map(stockResult.rows.map((row) => [Number(row.id), Number(row.stock_quantity)]));
		for (const item of snapshot) {
			const sizeId = Number(item.product_size_id);
			const quantity = Number(item.quantity);
			const stock = stockMap.get(sizeId);
			if (stock === undefined || quantity > stock) {
				await client.query('ROLLBACK');
				return res.status(400).json({
					message: `Bien the san pham ID ${sizeId} khong du hang (Con: ${stock || 0})`
				});
			}
		}

		const totalAmount = Number(pending.total_amount) || computeSnapshotTotal(snapshot);

		const orderInsert = await client.query(
			`
				INSERT INTO orders (user_id, total_amount, final_amount, status)
				VALUES ($1, $2, $3, 'pending')
				RETURNING id
			`,
			[userId, totalAmount, totalAmount]
		);
		const orderId = orderInsert.rows[0].id;

		for (const item of snapshot) {
			await client.query(
				`
					INSERT INTO order_items (
						order_id,
						product_size_id,
						snapshot_product_id,
						snapshot_product_size_id,
						snapshot_product_name,
						snapshot_size_name,
						snapshot_image_url,
						quantity,
						price
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				`,
				[
					orderId,
					Number(item.product_size_id),
					Number(item.product_id) || null,
					Number(item.product_size_id),
					item.product_name || null,
					item.size_name || null,
					item.image_url || null,
					Number(item.quantity),
					Number(item.price)
				]
			);

			await client.query(
				'UPDATE product_sizes SET stock_quantity = stock_quantity - $1 WHERE id = $2',
				[Number(item.quantity), Number(item.product_size_id)]
			);
		}

		await client.query('DELETE FROM cart_items WHERE cart_id = $1', [pending.cart_id]);

		await client.query(
			`
				UPDATE pending_payments
				SET order_id = $1,
					status = 'success',
					updated_at = CURRENT_TIMESTAMP
				WHERE id = $2
			`,
			[orderId, pending.id]
		);

		await client.query('COMMIT');
		return res.status(201).json({ message: 'Đặt hàng thành công', orderId });
	} catch (error) {
		await client.query('ROLLBACK');
		console.error('finalizeMomoOrder error:', error);
		return res.status(500).json({ message: 'Lỗi server khi xác nhận đơn MoMo.' });
	} finally {
		client.release();
	}
};

module.exports = {
	createMomoPayment,
	handleMomoIpn,
	finalizeMomoOrder
};
