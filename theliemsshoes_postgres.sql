-- PostgreSQL version of theliemsshoes database

-- Drop tables
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS user_coupons CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS pending_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_sizes CASCADE;
DROP TABLE IF EXISTS sizes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_type CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'customer',
  full_name VARCHAR(100),
  phone_number VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE product_type (
  id SERIAL PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER,
  product_type_id INTEGER,
  product_name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (product_type_id) REFERENCES product_type(id) ON DELETE SET NULL
);

CREATE TABLE sizes (
  id SERIAL PRIMARY KEY,
  size_name VARCHAR(20) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE product_sizes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  UNIQUE (product_id, size_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE RESTRICT
);

CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  coupon_name VARCHAR(150) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount DECIMAL(10,2) DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount_amount DECIMAL(10,2) CHECK (max_discount_amount >= 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL,
  product_size_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (cart_id, product_size_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  total_amount DECIMAL(10,2),
  coupon_id INTEGER,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_amount DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

CREATE TABLE pending_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cart_id INTEGER NOT NULL,
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
  order_id INTEGER,
  expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('pending', 'success', 'failed', 'expired')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_size_id INTEGER,
  snapshot_product_id INTEGER,
  snapshot_product_size_id INTEGER,
  snapshot_product_name VARCHAR(200),
  snapshot_size_name VARCHAR(20),
  snapshot_image_url TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL,
  UNIQUE (order_id, product_size_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION f_update_product_and_sync_cart(
  p_product_id INTEGER,
  p_category_id INTEGER,
  p_product_type_id INTEGER,
  p_product_name TEXT,
  p_description TEXT,
  p_price NUMERIC,
  p_size_stocks JSONB DEFAULT NULL,
  p_image_urls JSONB DEFAULT NULL
)
RETURNS TABLE(updated_product_id INTEGER, removed_cart_items INTEGER, removed_size_ids INTEGER[])
LANGUAGE plpgsql
AS $$
DECLARE
  v_removed_size_ids INTEGER[] := '{}';
  v_removed_cart_items INTEGER := 0;
BEGIN
  PERFORM 1 FROM products WHERE id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  UPDATE products
  SET category_id = p_category_id,
      product_type_id = p_product_type_id,
      product_name = p_product_name,
      description = p_description,
      price = p_price
  WHERE id = p_product_id;

  IF p_size_stocks IS NOT NULL THEN
    CREATE TEMP TABLE tmp_size_stocks (
      size_id INTEGER,
      size_name TEXT,
      stock_quantity INTEGER,
      resolved_size_id INTEGER
    ) ON COMMIT DROP;

    INSERT INTO tmp_size_stocks (size_id, size_name, stock_quantity)
    SELECT
      NULLIF(TRIM(item->>'size_id'), '')::INTEGER,
      NULLIF(TRIM(item->>'size_name'), ''),
      GREATEST(COALESCE((item->>'stock_quantity')::INTEGER, 0), 0)
    FROM jsonb_array_elements(p_size_stocks) AS item;

    UPDATE tmp_size_stocks t
    SET resolved_size_id = t.size_id
    WHERE t.size_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM sizes s WHERE s.id = t.size_id);

    UPDATE tmp_size_stocks t
    SET resolved_size_id = s.id
    FROM sizes s
    WHERE t.resolved_size_id IS NULL
      AND t.size_name IS NOT NULL
      AND s.size_name = t.size_name;

    INSERT INTO sizes (size_name)
    SELECT DISTINCT t.size_name
    FROM tmp_size_stocks t
    WHERE t.resolved_size_id IS NULL
      AND t.size_name IS NOT NULL
    ON CONFLICT (size_name) DO NOTHING;

    UPDATE tmp_size_stocks t
    SET resolved_size_id = s.id
    FROM sizes s
    WHERE t.resolved_size_id IS NULL
      AND t.size_name IS NOT NULL
      AND s.size_name = t.size_name;

    IF EXISTS (SELECT 1 FROM tmp_size_stocks WHERE resolved_size_id IS NULL) THEN
      RAISE EXCEPTION 'Invalid size payload for product %', p_product_id;
    END IF;

    CREATE TEMP TABLE tmp_size_merged (
      resolved_size_id INTEGER PRIMARY KEY,
      stock_quantity INTEGER NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO tmp_size_merged (resolved_size_id, stock_quantity)
    SELECT resolved_size_id, SUM(stock_quantity)::INTEGER
    FROM tmp_size_stocks
    GROUP BY resolved_size_id;

    SELECT COALESCE(array_agg(ps.id), '{}')
    INTO v_removed_size_ids
    FROM product_sizes ps
    WHERE ps.product_id = p_product_id
      AND NOT EXISTS (
        SELECT 1
        FROM tmp_size_merged t
        WHERE t.resolved_size_id = ps.size_id
      );

    IF array_length(v_removed_size_ids, 1) IS NOT NULL THEN
      DELETE FROM cart_items
      WHERE product_size_id = ANY(v_removed_size_ids);
      GET DIAGNOSTICS v_removed_cart_items = ROW_COUNT;

      DELETE FROM product_sizes
      WHERE id = ANY(v_removed_size_ids);
    END IF;

    INSERT INTO product_sizes (product_id, size_id, stock_quantity)
    SELECT p_product_id, t.resolved_size_id, t.stock_quantity
    FROM tmp_size_merged t
    ON CONFLICT (product_id, size_id)
    DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity;
  END IF;

  IF p_image_urls IS NOT NULL THEN
    DELETE FROM product_images WHERE product_id = p_product_id;

    INSERT INTO product_images (product_id, image_url)
    SELECT p_product_id, TRIM(value)
    FROM jsonb_array_elements_text(p_image_urls) AS value
    WHERE TRIM(value) <> '';
  END IF;

  updated_product_id := p_product_id;
  removed_cart_items := v_removed_cart_items;
  removed_size_ids := v_removed_size_ids;

  RETURN NEXT;
END;
$$;

CREATE TABLE user_coupons (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  coupon_id INTEGER NOT NULL,
  won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_at TIMESTAMP,
  order_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CHECK ((is_redeemed = FALSE AND redeemed_at IS NULL) OR (is_redeemed = TRUE AND redeemed_at IS NOT NULL))
);

-- Insert data
INSERT INTO categories (id, category_name, description) VALUES (1, 'Men', 'Shoes designed for men, including formal, casual, and sports styles.');
INSERT INTO categories (id, category_name, description) VALUES (2, 'Women', 'Shoes designed for women, including heels, flats, sneakers, and sandals.');
INSERT INTO categories (id, category_name, description) VALUES (3, 'Children', 'Shoes designed for kids, focusing on comfort, durability, and safety.');
INSERT INTO categories (id, category_name, description) VALUES (4, 'Sale', 'Discover unbeatable deals on a wide range of stylish and high-quality shoes. Our Sale collection features exclusive discounts on top designs, from everyday essentials to standout statement pieces. Don''t miss the chance to upgrade your footwear at the best prices—limited stock available!');

INSERT INTO product_type (id, type_name, description) VALUES (1, 'Fashion', 'Stylish footwear designed to complement modern outfits and express personal fashion sense.');
INSERT INTO product_type (id, type_name, description) VALUES (2, 'Football', 'Specialized shoes engineered for optimal traction, control, and performance on the football field.');
INSERT INTO product_type (id, type_name, description) VALUES (3, 'Running', 'Lightweight and cushioned footwear built to provide comfort and support during running activities.');
INSERT INTO product_type (id, type_name, description) VALUES (4, 'Basketball', 'High-performance shoes designed for ankle support, grip, and agility on the basketball court.');
INSERT INTO product_type (id, type_name, description) VALUES (5, 'Tennis', 'Durable and stable footwear crafted for quick lateral movements on tennis courts.');
INSERT INTO product_type (id, type_name, description) VALUES (6, 'Skateboarding', 'Rugged shoes with flat soles for better board control and durability during skateboarding.');
INSERT INTO product_type (id, type_name, description) VALUES (7, 'Hiking', 'Sturdy footwear designed to provide traction, support, and protection on outdoor trails.');
INSERT INTO product_type (id, type_name, description) VALUES (8, 'Casual', 'Comfortable everyday shoes suitable for relaxed, daily wear and versatile use.');
INSERT INTO product_type (id, type_name, description) VALUES (9, 'Sandals', 'Open-toe footwear designed for breathability and comfort in warm weather.');
INSERT INTO product_type (id, type_name, description) VALUES (10, 'Boots', 'Durable footwear offering enhanced protection, support, and style for various conditions.');

INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (1, 2, 3, 'Nike Winflo 12', 'Built with a Nike Air unit and a thick stack of Cushlon 3.0 foam, the Winflo 12 is the perfect combination of enhanced responsiveness and consistent cushioning. Breathable mesh up top and an accommodating fit help you feel locked in and ready to push for that extra mile.', '3089000.00', '2026-03-21T10:16:09.740Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (2, 3, 1, 'Nike Air Force 1 LV8 3', 'The classic blocking on the upper, Air unit underfoot and unmistakable shape make the AF1 a sneaker staple that never misses.', '2679000.00', '2026-03-21T10:17:39.793Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (3, 1, 2, 'Jordan Tiempo Maestro Elite SE', 'Wreaking havoc on the defence requires total command of the ball. That''s why we designed every aspect of the Tiempo Maestro Elite to put you in complete control of every touch. Its all-new Techleather material, softer than natural leather, combines with a flexible Maestro360 plate to give you a glove-like fit no matter where the ball strikes.', '7759000.00', '2026-03-21T10:14:03.709Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (4, 1, 1, 'Air Force 1', 'Comfortable, durable and timeless – it''s number one for a reason. The Air Force 1 pairs its classic silhouette with synthetic leather for a crisp, clean look.', '3239000.00', '2026-03-21T09:55:41.653Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (5, 1, 1, 'Nike Air Force 1 ''07', 'Comfortable, durable and timeless—it''s number one for a reason. The classic ''80s construction pairs smooth leather with bold details for style that tracks whether you''re on court or on the go.', '2929000.00', '2026-03-22T03:25:17.685Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (6, 2, 1, 'Jordan Flight Court', 'Inspired by the past, built for tomorrow. We remixed elements from the AJ3, AJ4 and AJ5 to create a fresh take on the classics. Smooth leather and soft suede give you style and durability while textile panels add breathability. Plus, embroidered details infuse these kicks with Jordan heritage.', '2920000.00', '2026-03-21T19:23:59.520Z');

INSERT INTO sizes (id, size_name, description) VALUES (1, '38', 'EU size 38');
INSERT INTO sizes (id, size_name, description) VALUES (2, '39', 'EU size 39');
INSERT INTO sizes (id, size_name, description) VALUES (3, '40', 'EU size 40');
INSERT INTO sizes (id, size_name, description) VALUES (4, '41', 'EU size 41');
INSERT INTO sizes (id, size_name, description) VALUES (5, '42', 'EU size 42');
INSERT INTO sizes (id, size_name, description) VALUES (6, '43', 'EU size 43');

INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (1, 1, 2, 0);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (2, 1, 3, 31);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (3, 1, 4, 34);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (4, 1, 5, 26);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (5, 2, 1, 18);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (6, 2, 2, 20);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (7, 2, 3, 16);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (8, 2, 4, 15);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (9, 3, 3, 30);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (10, 3, 4, 33);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (11, 3, 5, 26);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (12, 4, 2, 31);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (13, 4, 3, 34);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (14, 4, 4, 34);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (15, 5, 1, 65);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (16, 5, 2, 72);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (17, 5, 3, 81);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (18, 5, 4, 83);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (19, 6, 2, 25);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (20, 6, 3, 28);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (21, 6, 4, 29);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (22, 6, 5, 30);

INSERT INTO product_images (id, product_id, image_url) VALUES (1, 4, '/uploads/1774112141537-AIR_FORCE_1__07.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (2, 3, '/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (3, 1, '/uploads/1774113369723-NIKE_AIR_WINFLO_12.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (4, 2, '/uploads/1774113459756-AIR_FORCE_1_LV8_3__GS_.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (5, 6, '/uploads/1774146239490-WMNS_JORDAN_FLIGHT_COURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (6, 5, '/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (7, 3, '/uploads/1774250380203-TIEMPO_MAESTRO_ELITE_FG_SE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (8, 3, '/uploads/1774250393091-TIEMPO_MAESTRO_ELITE_FE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (9, 4, '/uploads/1774270134911-2AIR_FORCE_1_07.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (10, 4, '/uploads/1774270145414-3AIR_FORCE_1_07.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (11, 5, '/uploads/1774270224201-1AIRFORCE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (12, 5, '/uploads/1774270234314-2AIRFORCE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (13, 6, '/uploads/1774270325819-1JORDANFLIGHTCOURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (14, 6, '/uploads/1774270335333-2JORDANFLIGHTCOURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (15, 1, '/uploads/1774270378856-1NIKEAIRWINFLO.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (16, 1, '/uploads/1774270425467-2NIKEAIRWINFLO.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (17, 2, '/uploads/1774270481761-1AIRFORCE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (18, 2, '/uploads/1774270490829-2AIRFORCE.png');

INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (1, 'admin', 'admin@theliemsshoes.com', '$2b$10$sTiIk4n4XaizP6EcDbNcr.klxWMrcxTVQ0cVY1YdaEW1k5Mv1gsyu', 'admin', NULL, '0901234567', NULL, '2026-03-20T00:42:46.985Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (2, 'Trần Hữu Lộc', 'customer1@gmail.com', '$2b$10$/RRgVyISLQM78Pn6bFWmBu3ChQiqC4jDIfZDlFR2pSUEiAfYPnCsy', 'customer', NULL, '0123456789', NULL, '2026-03-20T00:45:19.376Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (3, 'Lê Dương Anh Tuấn', 'customer2@gmail.com', '$2b$10$FYu8E.lRjHTuo0YyqJjw/OUo8I8BhzbIm3DlHn0OqRPjV4GglCQNi', 'customer', NULL, '0990123456', NULL, '2026-03-20T00:45:42.173Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (4, 'Lý Hậu Nghĩa', 'customer3@gmail.com', '$2b$10$ElnOX70rFUGKF41jenQ0zOfKocaP/o1KvOarC8I2AvcpBAHg9S8d2', 'customer', NULL, '0102030405', NULL, '2026-03-20T00:46:02.474Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (5, 'Tô Nhật Hào', 'customer4@gmail.com', '$2b$10$Czkj4tlym0VVsMltyJFX5.FUEKfM/wfyFImsGBH8MIMxkTuANLK3i', 'customer', NULL, '0990123456', NULL, '2026-03-20T00:46:22.568Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (6, 'Huỳnh Quang Thiện', 'customer6@gmail.com', '$2b$10$kyG5ZXEIlR/bguRNiulk.O.oxMyJVVS67Ndh0.Xm9jk5Jm5OQDkAK', 'customer', NULL, '0908070605', NULL, '2026-03-20T00:46:45.073Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (7, 'abc@gmail.com', 'asd@gmail.com', '$2b$10$k7O0CvzqQlj33Ev0i8xASey9SybgIGgEIzIKISg74HXWpZKHGfoUm', 'customer', NULL, '0923456789', NULL, '2026-03-23T06:08:38.370Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (8, 'nhathao0910', 'nhathao0910@gmail.com', '$2b$10$aRj3HDhR3qowsEOLZJQeluZU5s2gkODFOe4x4kGPGSwuKadjJkive', 'customer', NULL, '091020041234', NULL, '2026-03-23T19:49:46.609Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (9, 'a112121', 'a@gmail.com', '$2b$10$EFvwsNVZAvq79pTXDPpqbeq7rChkupIhJ8zOrgK6FwQE54gil144W', 'customer', NULL, '1', NULL, '2026-03-23T20:15:54.706Z');

INSERT INTO coupons (id, code, coupon_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, per_user_limit, starts_at, expires_at, is_active, created_at) VALUES (1, 'SPIN10', 'Lucky Wheel 10%', 'Giam 10% toi da 200000 VND cho don tu 500000 VND', 'percent', 10, 500000, 200000, 500, 0, 1, '2026-03-01T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, '2026-03-21T00:00:00Z');
INSERT INTO coupons (id, code, coupon_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, per_user_limit, starts_at, expires_at, is_active, created_at) VALUES (2, 'SPIN50K', 'Lucky Wheel 50K', 'Giam truc tiep 50000 VND cho don tu 400000 VND', 'fixed', 50000, 400000, NULL, 700, 1, 1, '2026-03-01T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, '2026-03-21T00:00:00Z');
INSERT INTO coupons (id, code, coupon_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, per_user_limit, starts_at, expires_at, is_active, created_at) VALUES (3, 'SPIN15', 'Lucky Wheel 15%', 'Giam 15% toi da 300000 VND cho don tu 1200000 VND', 'percent', 15, 1200000, 300000, 200, 0, 1, '2026-03-01T00:00:00Z', '2026-12-31T23:59:59Z', TRUE, '2026-03-21T00:00:00Z');

INSERT INTO carts (id, user_id, created_at) VALUES (1, 2, '2026-03-24T07:10:00Z');
INSERT INTO carts (id, user_id, created_at) VALUES (2, 3, '2026-03-24T07:20:00Z');
INSERT INTO carts (id, user_id, created_at) VALUES (3, 5, '2026-03-24T07:30:00Z');

INSERT INTO cart_items (id, cart_id, product_size_id, quantity) VALUES (1, 1, 13, 1);
INSERT INTO cart_items (id, cart_id, product_size_id, quantity) VALUES (2, 1, 17, 2);
INSERT INTO cart_items (id, cart_id, product_size_id, quantity) VALUES (3, 2, 9, 1);
INSERT INTO cart_items (id, cart_id, product_size_id, quantity) VALUES (4, 3, 20, 1);

INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (1, 3, 5918000, 2, 50000, 5868000, 'completed', '2026-03-24T08:00:00Z');
INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (2, 5, 7759000, NULL, 0, 7759000, 'pending', '2026-03-24T08:20:00Z');

INSERT INTO order_items (
  id,
  order_id,
  product_size_id,
  snapshot_product_id,
  snapshot_product_size_id,
  snapshot_product_name,
  snapshot_size_name,
  snapshot_image_url,
  quantity,
  price
) VALUES (1, 1, 13, 4, 13, 'Air Force 1', '40', '/uploads/1774112141537-AIR_FORCE_1__07.jpg', 1, 3239000);

INSERT INTO order_items (
  id,
  order_id,
  product_size_id,
  snapshot_product_id,
  snapshot_product_size_id,
  snapshot_product_name,
  snapshot_size_name,
  snapshot_image_url,
  quantity,
  price
) VALUES (2, 1, 6, 2, 6, 'Nike Air Force 1 LV8 3', '39', '/uploads/1774113459756-AIR_FORCE_1_LV8_3__GS_.png', 1, 2679000);

INSERT INTO order_items (
  id,
  order_id,
  product_size_id,
  snapshot_product_id,
  snapshot_product_size_id,
  snapshot_product_name,
  snapshot_size_name,
  snapshot_image_url,
  quantity,
  price
) VALUES (3, 2, 10, 3, 10, 'Jordan Tiempo Maestro Elite SE', '41', '/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg', 1, 7759000);

INSERT INTO user_coupons (id, user_id, coupon_id, won_at, is_redeemed, redeemed_at, order_id) VALUES (1, 2, 1, '2026-03-23T08:00:00Z', FALSE, NULL, NULL);
INSERT INTO user_coupons (id, user_id, coupon_id, won_at, is_redeemed, redeemed_at, order_id) VALUES (2, 3, 2, '2026-03-23T08:05:00Z', TRUE, '2026-03-24T08:00:00Z', 1);
INSERT INTO user_coupons (id, user_id, coupon_id, won_at, is_redeemed, redeemed_at, order_id) VALUES (3, 5, 3, '2026-03-23T08:15:00Z', FALSE, NULL, NULL);

-- Reset sequences after insert
SELECT setval('public.categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 0) + 1, FALSE);
SELECT setval('public.product_type_id_seq', COALESCE((SELECT MAX(id) FROM product_type), 0) + 1, FALSE);
SELECT setval('public.products_id_seq', COALESCE((SELECT MAX(id) FROM products), 0) + 1, FALSE);
SELECT setval('public.sizes_id_seq', COALESCE((SELECT MAX(id) FROM sizes), 0) + 1, FALSE);
SELECT setval('public.product_sizes_id_seq', COALESCE((SELECT MAX(id) FROM product_sizes), 0) + 1, FALSE);
SELECT setval('public.product_images_id_seq', COALESCE((SELECT MAX(id) FROM product_images), 0) + 1, FALSE);
SELECT setval('public.users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, FALSE);
SELECT setval('public.carts_id_seq', COALESCE((SELECT MAX(id) FROM carts), 0) + 1, FALSE);
SELECT setval('public.cart_items_id_seq', COALESCE((SELECT MAX(id) FROM cart_items), 0) + 1, FALSE);
SELECT setval('public.orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 0) + 1, FALSE);
SELECT setval('public.order_items_id_seq', COALESCE((SELECT MAX(id) FROM order_items), 0) + 1, FALSE);
SELECT setval('public.coupons_id_seq', COALESCE((SELECT MAX(id) FROM coupons), 0) + 1, FALSE);
SELECT setval('public.user_coupons_id_seq', COALESCE((SELECT MAX(id) FROM user_coupons), 0) + 1, FALSE);
