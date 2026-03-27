-- PostgreSQL backup generated from Render database
-- Generated at: 2026-03-27T07:24:44.804Z

-- Drop tables
DROP TABLE IF EXISTS user_coupons CASCADE;
DROP TABLE IF EXISTS pending_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS product_sizes CASCADE;
DROP TABLE IF EXISTS sizes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_type CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Create tables
CREATE TABLE categories (
  id SERIAL NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE coupons (
  id SERIAL NOT NULL,
  code VARCHAR(50) NOT NULL,
  coupon_name VARCHAR(150) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0 NOT NULL,
  per_user_limit INTEGER DEFAULT 1 NOT NULL,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (code)
);

CREATE TABLE product_type (
  id SERIAL NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  description TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE products (
  id SERIAL NOT NULL,
  category_id INTEGER,
  product_type_id INTEGER,
  product_name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (product_type_id) REFERENCES product_type(id) ON DELETE SET NULL
);

CREATE TABLE product_images (
  id SERIAL NOT NULL,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE sizes (
  id SERIAL NOT NULL,
  size_name VARCHAR(20) NOT NULL,
  description TEXT,
  PRIMARY KEY (id),
  UNIQUE (size_name)
);

CREATE TABLE product_sizes (
  id SERIAL NOT NULL,
  product_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  stock_quantity INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (product_id, size_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE RESTRICT
);

CREATE TABLE users (
  id SERIAL NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'customer'::character varying,
  full_name VARCHAR(100),
  phone_number VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE (email),
  UNIQUE (username)
);

CREATE TABLE carts (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
  id SERIAL NOT NULL,
  cart_id INTEGER NOT NULL,
  product_size_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (cart_id, product_size_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  total_amount DECIMAL(10,2),
  coupon_id INTEGER,
  discount_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  final_amount DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'pending'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id SERIAL NOT NULL,
  order_id INTEGER NOT NULL,
  product_size_id INTEGER,
  snapshot_product_id INTEGER,
  snapshot_product_size_id INTEGER,
  snapshot_product_name VARCHAR(200),
  snapshot_size_name VARCHAR(20),
  snapshot_image_url TEXT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (order_id, product_size_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_size_id) REFERENCES product_sizes(id) ON DELETE SET NULL
);

CREATE TABLE pending_payments (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  cart_id INTEGER NOT NULL,
  cart_snapshot JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_info JSONB,
  payment_method VARCHAR(20) DEFAULT 'momo'::character varying NOT NULL,
  request_id VARCHAR(120) NOT NULL,
  momo_order_id VARCHAR(120) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'::character varying NOT NULL,
  result_code VARCHAR(30),
  message TEXT,
  trans_id VARCHAR(120),
  order_id INTEGER,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + '00:30:00'::interval) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (momo_order_id),
  UNIQUE (request_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_coupons (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  coupon_id INTEGER NOT NULL,
  won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_redeemed BOOLEAN DEFAULT false NOT NULL,
  redeemed_at TIMESTAMP,
  order_id INTEGER,
  PRIMARY KEY (id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert data
INSERT INTO categories (id, category_name, description) VALUES (1, 'Men', 'Shoes designed for men, including formal, casual, and sports styles.');
INSERT INTO categories (id, category_name, description) VALUES (2, 'Women', 'Shoes designed for women, including heels, flats, sneakers, and sandals.');
INSERT INTO categories (id, category_name, description) VALUES (3, 'Children', 'Shoes designed for kids, focusing on comfort, durability, and safety.');
INSERT INTO categories (id, category_name, description) VALUES (4, 'Sale', 'Discover unbeatable deals on a wide range of stylish and high-quality shoes. Our Sale collection features exclusive discounts on top designs, from everyday essentials to standout statement pieces. Don''t miss the chance to upgrade your footwear at the best prices—limited stock available!');

INSERT INTO coupons (id, code, coupon_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, per_user_limit, starts_at, expires_at, is_active, created_at) VALUES (1, 'SPIN10', 'Lucky Wheel 10%', 'Giam 10% toi da 200000 VND cho don tu 500000 VND', 'percent', '10.00', '500000.00', '200000.00', 500, 0, 1, '2026-02-28T17:00:00.000Z', '2026-12-31T16:59:59.000Z', TRUE, '2026-03-20T17:00:00.000Z');
INSERT INTO coupons (id, code, coupon_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, per_user_limit, starts_at, expires_at, is_active, created_at) VALUES (2, 'SPIN50K', 'Lucky Wheel 50K', 'Giam truc tiep 50000 VND cho don tu 400000 VND', 'fixed', '50000.00', '400000.00', NULL, 700, 1, 1, '2026-02-28T17:00:00.000Z', '2026-12-31T16:59:59.000Z', TRUE, '2026-03-20T17:00:00.000Z');
INSERT INTO coupons (id, code, coupon_name, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, per_user_limit, starts_at, expires_at, is_active, created_at) VALUES (3, 'SPIN15', 'Lucky Wheel 15%', 'Giam 15% toi da 300000 VND cho don tu 1200000 VND', 'percent', '15.00', '1200000.00', '300000.00', 200, 0, 1, '2026-02-28T17:00:00.000Z', '2026-12-31T16:59:59.000Z', TRUE, '2026-03-20T17:00:00.000Z');

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

INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (1, 2, 3, 'Nike Winflo 12', 'Built with a Nike Air unit and a thick stack of Cushlon 3.0 foam, the Winflo 12 is the perfect combination of enhanced responsiveness and consistent cushioning. Breathable mesh up top and an accommodating fit help you feel locked in and ready to push for that extra mile.', '3089000.00', '2026-03-21T03:16:09.740Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (2, 3, 1, 'Nike Air Force 1 LV8 3', 'The classic blocking on the upper, Air unit underfoot and unmistakable shape make the AF1 a sneaker staple that never misses.', '2679000.00', '2026-03-21T03:17:39.793Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (4, 1, 1, 'Air Force 1', 'Comfortable, durable and timeless – it''s number one for a reason. The Air Force 1 pairs its classic silhouette with synthetic leather for a crisp, clean look.', '3239000.00', '2026-03-21T02:55:41.653Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (5, 1, 1, 'Nike Air Force 1 ''07', 'Comfortable, durable and timeless—it''s number one for a reason. The classic ''80s construction pairs smooth leather with bold details for style that tracks whether you''re on court or on the go.', '2929000.00', '2026-03-21T20:25:17.685Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (6, 2, 1, 'Jordan Flight Court', 'Inspired by the past, built for tomorrow. We remixed elements from the AJ3, AJ4 and AJ5 to create a fresh take on the classics. Smooth leather and soft suede give you style and durability while textile panels add breathability. Plus, embroidered details infuse these kicks with Jordan heritage.', '2920000.00', '2026-03-21T12:23:59.520Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, created_at) VALUES (3, 1, 2, 'Jordan Tiempo Maestro Elite SE', 'Wreaking havoc on the defence requires total command of the ball. That''s why we designed every aspect of the Tiempo Maestro Elite to put you in complete control of every touch. Its all-new Techleather material, softer than natural leather, combines with a flexible Maestro360 plate to give you a glove-like fit no matter where the ball strikes.', '7758000.00', '2026-03-21T03:14:03.709Z');

INSERT INTO product_images (id, product_id, image_url) VALUES (1, 4, '/uploads/1774112141537-AIR_FORCE_1__07.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (3, 1, '/uploads/1774113369723-NIKE_AIR_WINFLO_12.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (4, 2, '/uploads/1774113459756-AIR_FORCE_1_LV8_3__GS_.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (5, 6, '/uploads/1774146239490-WMNS_JORDAN_FLIGHT_COURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (6, 5, '/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg');
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
INSERT INTO product_images (id, product_id, image_url) VALUES (19, 3, '/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (20, 3, '/uploads/1774250380203-TIEMPO_MAESTRO_ELITE_FG_SE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (21, 3, '/uploads/1774250393091-TIEMPO_MAESTRO_ELITE_FE.png');

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
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (12, 4, 2, 31);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (14, 4, 4, 34);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (15, 5, 1, 65);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (16, 5, 2, 72);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (19, 6, 2, 25);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (20, 6, 3, 28);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (21, 6, 4, 29);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (22, 6, 5, 30);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (11, 3, 5, 26);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (10, 3, 4, 33);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (9, 3, 3, 29);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (13, 4, 3, 33);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (17, 5, 3, 79);
INSERT INTO product_sizes (id, product_id, size_id, stock_quantity) VALUES (18, 5, 4, 82);

INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (1, 'admin', 'admin@theliemsshoes.com', '$2b$10$sTiIk4n4XaizP6EcDbNcr.klxWMrcxTVQ0cVY1YdaEW1k5Mv1gsyu', 'admin', NULL, '0901234567', NULL, '2026-03-19T17:42:46.985Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (2, 'Trần Hữu Lộc', 'customer1@gmail.com', '$2b$10$/RRgVyISLQM78Pn6bFWmBu3ChQiqC4jDIfZDlFR2pSUEiAfYPnCsy', 'customer', NULL, '0123456789', NULL, '2026-03-19T17:45:19.376Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (3, 'Lê Dương Anh Tuấn', 'customer2@gmail.com', '$2b$10$FYu8E.lRjHTuo0YyqJjw/OUo8I8BhzbIm3DlHn0OqRPjV4GglCQNi', 'customer', NULL, '0990123456', NULL, '2026-03-19T17:45:42.173Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (4, 'Lý Hậu Nghĩa', 'customer3@gmail.com', '$2b$10$ElnOX70rFUGKF41jenQ0zOfKocaP/o1KvOarC8I2AvcpBAHg9S8d2', 'customer', NULL, '0102030405', NULL, '2026-03-19T17:46:02.474Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (5, 'Tô Nhật Hào', 'customer4@gmail.com', '$2b$10$Czkj4tlym0VVsMltyJFX5.FUEKfM/wfyFImsGBH8MIMxkTuANLK3i', 'customer', NULL, '0990123456', NULL, '2026-03-19T17:46:22.568Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (6, 'Huỳnh Quang Thiện', 'customer6@gmail.com', '$2b$10$kyG5ZXEIlR/bguRNiulk.O.oxMyJVVS67Ndh0.Xm9jk5Jm5OQDkAK', 'customer', NULL, '0908070605', NULL, '2026-03-19T17:46:45.073Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (7, 'abc@gmail.com', 'asd@gmail.com', '$2b$10$k7O0CvzqQlj33Ev0i8xASey9SybgIGgEIzIKISg74HXWpZKHGfoUm', 'customer', NULL, '0923456789', NULL, '2026-03-22T23:08:38.370Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (8, 'nhathao0910', 'nhathao0910@gmail.com', '$2b$10$aRj3HDhR3qowsEOLZJQeluZU5s2gkODFOe4x4kGPGSwuKadjJkive', 'customer', NULL, '091020041234', NULL, '2026-03-23T12:49:46.609Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (9, 'a112121', 'a@gmail.com', '$2b$10$EFvwsNVZAvq79pTXDPpqbeq7rChkupIhJ8zOrgK6FwQE54gil144W', 'customer', NULL, '1', NULL, '2026-03-23T13:15:54.706Z');

INSERT INTO carts (id, user_id, created_at) VALUES (1, 2, '2026-03-24T00:10:00.000Z');
INSERT INTO carts (id, user_id, created_at) VALUES (2, 3, '2026-03-24T00:20:00.000Z');
INSERT INTO carts (id, user_id, created_at) VALUES (3, 5, '2026-03-24T00:30:00.000Z');
INSERT INTO carts (id, user_id, created_at) VALUES (4, 1, '2026-03-26T00:19:23.724Z');
INSERT INTO carts (id, user_id, created_at) VALUES (5, 4, '2026-03-27T00:21:15.676Z');

INSERT INTO cart_items (id, cart_id, product_size_id, quantity) VALUES (4, 3, 20, 1);
INSERT INTO cart_items (id, cart_id, product_size_id, quantity) VALUES (10, 4, 20, 1);

INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (1, 3, '5918000.00', 2, '50000.00', '5868000.00', 'completed', '2026-03-24T01:00:00.000Z');
INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (2, 5, '7759000.00', NULL, '0.00', '7759000.00', 'pending', '2026-03-24T01:20:00.000Z');
INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (3, 3, '7758000.00', NULL, '0.00', '7758000.00', 'pending', '2026-03-27T00:05:09.458Z');
INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (4, 2, '9097000.00', NULL, '0.00', '9097000.00', 'pending', '2026-03-27T00:19:29.085Z');
INSERT INTO orders (id, user_id, total_amount, coupon_id, discount_amount, final_amount, status, created_at) VALUES (5, 4, '2929000.00', NULL, '0.00', NULL, 'pending', '2026-03-27T00:23:57.497Z');

INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (1, 1, 13, 4, 13, 'Air Force 1', '40', '/uploads/1774112141537-AIR_FORCE_1__07.jpg', 1, '3239000.00');
INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (2, 1, 6, 2, 6, 'Nike Air Force 1 LV8 3', '39', '/uploads/1774113459756-AIR_FORCE_1_LV8_3__GS_.png', 1, '2679000.00');
INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (3, 2, 10, 3, 10, 'Jordan Tiempo Maestro Elite SE', '41', '/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg', 1, '7759000.00');
INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (4, 3, 9, 3, 9, 'Jordan Tiempo Maestro Elite SE', '40', '/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg', 1, '7758000.00');
INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (5, 4, 13, 4, 13, 'Air Force 1', '40', '/uploads/1774112141537-AIR_FORCE_1__07.jpg', 1, '3239000.00');
INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (6, 4, 17, 5, 17, 'Nike Air Force 1 ''07', '40', '/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg', 2, '2929000.00');
INSERT INTO order_items (id, order_id, product_size_id, snapshot_product_id, snapshot_product_size_id, snapshot_product_name, snapshot_size_name, snapshot_image_url, quantity, price) VALUES (7, 5, 18, 5, 18, 'Nike Air Force 1 ''07', '41', '/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg', 1, '2929000.00');

INSERT INTO pending_payments (id, user_id, cart_id, cart_snapshot, total_amount, shipping_info, payment_method, request_id, momo_order_id, status, result_code, message, trans_id, order_id, expires_at, created_at, updated_at) VALUES (1, 3, 2, '[{"price":7758000,"quantity":1,"image_url":"/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg","size_name":"40","product_id":3,"product_name":"Jordan Tiempo Maestro Elite SE","product_size_id":9}]'::jsonb, '7758000.00', '{"email":"customer2@gmail.com","phone":"0990123456","address":"Nhà Tuấn Sora","fullName":"Lê Dương Anh Tuấn"}'::jsonb, 'momo', 'REQ_3_1774595077391', 'MOMO_3_1774595077391', 'success', '0', 'Thành công.', '4712689049', 3, '2026-03-27T00:34:39.792Z', '2026-03-27T00:04:39.792Z', '2026-03-27T00:05:09.458Z');
INSERT INTO pending_payments (id, user_id, cart_id, cart_snapshot, total_amount, shipping_info, payment_method, request_id, momo_order_id, status, result_code, message, trans_id, order_id, expires_at, created_at, updated_at) VALUES (2, 2, 1, '[{"price":3239000,"quantity":1,"image_url":"/uploads/1774112141537-AIR_FORCE_1__07.jpg","size_name":"40","product_id":4,"product_name":"Air Force 1","product_size_id":13},{"price":2929000,"quantity":2,"image_url":"/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg","size_name":"40","product_id":5,"product_name":"Nike Air Force 1 ''07","product_size_id":17}]'::jsonb, '9097000.00', '{"email":"customer1@gmail.com","phone":"0123456789","address":"Admin''s Home","fullName":"Trần Hữu Lộc"}'::jsonb, 'momo', 'REQ_2_1774595926634', 'MOMO_2_1774595926634', 'success', '0', 'Thành công.', '4712672705', 4, '2026-03-27T00:48:46.530Z', '2026-03-27T00:18:46.530Z', '2026-03-27T00:19:29.085Z');
INSERT INTO pending_payments (id, user_id, cart_id, cart_snapshot, total_amount, shipping_info, payment_method, request_id, momo_order_id, status, result_code, message, trans_id, order_id, expires_at, created_at, updated_at) VALUES (3, 4, 5, '[{"price":2929000,"quantity":1,"image_url":"/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg","size_name":"41","product_id":5,"product_name":"Nike Air Force 1 ''07","product_size_id":18}]'::jsonb, '2929000.00', '{"email":"customer3@gmail.com","phone":"0321546789","address":"Nhà Nghĩa","fullName":"Lý Hậu Nghĩa"}'::jsonb, 'momo', 'REQ_4_1774596106752', 'MOMO_4_1774596106752', 'pending', NULL, NULL, NULL, NULL, '2026-03-27T00:51:46.734Z', '2026-03-27T00:21:46.734Z', '2026-03-27T00:21:46.734Z');

INSERT INTO user_coupons (id, user_id, coupon_id, won_at, is_redeemed, redeemed_at, order_id) VALUES (1, 2, 1, '2026-03-23T01:00:00.000Z', FALSE, NULL, NULL);
INSERT INTO user_coupons (id, user_id, coupon_id, won_at, is_redeemed, redeemed_at, order_id) VALUES (2, 3, 2, '2026-03-23T01:05:00.000Z', TRUE, '2026-03-24T01:00:00.000Z', 1);
INSERT INTO user_coupons (id, user_id, coupon_id, won_at, is_redeemed, redeemed_at, order_id) VALUES (3, 5, 3, '2026-03-23T01:15:00.000Z', FALSE, NULL, NULL);

-- Reset sequences after insert
SELECT setval('public.categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1), TRUE);
SELECT setval('public.coupons_id_seq', COALESCE((SELECT MAX(id) FROM coupons), 1), TRUE);
SELECT setval('public.product_type_id_seq', COALESCE((SELECT MAX(id) FROM product_type), 1), TRUE);
SELECT setval('public.products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1), TRUE);
SELECT setval('public.product_images_id_seq', COALESCE((SELECT MAX(id) FROM product_images), 1), TRUE);
SELECT setval('public.sizes_id_seq', COALESCE((SELECT MAX(id) FROM sizes), 1), TRUE);
SELECT setval('public.product_sizes_id_seq', COALESCE((SELECT MAX(id) FROM product_sizes), 1), TRUE);
SELECT setval('public.users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), TRUE);
SELECT setval('public.carts_id_seq', COALESCE((SELECT MAX(id) FROM carts), 1), TRUE);
SELECT setval('public.cart_items_id_seq', COALESCE((SELECT MAX(id) FROM cart_items), 1), TRUE);
SELECT setval('public.orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1), TRUE);
SELECT setval('public.order_items_id_seq', COALESCE((SELECT MAX(id) FROM order_items), 1), TRUE);
SELECT setval('public.pending_payments_id_seq', COALESCE((SELECT MAX(id) FROM pending_payments), 1), TRUE);
SELECT setval('public.user_coupons_id_seq', COALESCE((SELECT MAX(id) FROM user_coupons), 1), TRUE);
