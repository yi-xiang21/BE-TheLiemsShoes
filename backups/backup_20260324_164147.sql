-- PostgreSQL backup generated from Render database
-- Generated at: 2026-03-24T09:41:44.231Z

-- Drop tables
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_type CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Create tables
CREATE TABLE categories (
  id SERIAL NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  PRIMARY KEY (id)
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
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE product_images (
  id SERIAL NOT NULL,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
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
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE (cart_id, product_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE orders (
  id SERIAL NOT NULL,
  user_id INTEGER NOT NULL,
  total_amount DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'pending'::character varying,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id SERIAL NOT NULL,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (order_id, product_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert data
INSERT INTO categories (id, category_name, description) VALUES (3, 'Men', 'Shoes designed for men, including formal, casual, and sports styles.');
INSERT INTO categories (id, category_name, description) VALUES (4, 'Women', 'Shoes designed for women, including heels, flats, sneakers, and sandals.');
INSERT INTO categories (id, category_name, description) VALUES (5, 'Children', 'Shoes designed for kids, focusing on comfort, durability, and safety.');
INSERT INTO categories (id, category_name, description) VALUES (6, 'Sale', 'Discover unbeatable deals on a wide range of stylish and high-quality shoes. Our Sale collection features exclusive discounts on top designs, from everyday essentials to standout statement pieces. Don’t miss the chance to upgrade your footwear at the best prices—limited stock available!');

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

INSERT INTO products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) VALUES (5, 4, 3, 'Nike Winflo 12', 'Built with a Nike Air unit and a thick stack of Cushlon 3.0 foam, the Winflo 12 is the perfect combination of enhanced responsiveness and consistent cushioning. Breathable mesh up top and an accommodating fit help you feel locked in and ready to push for that extra mile.', '3089000.00', 91, '2026-03-21T10:16:09.740Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) VALUES (6, 5, 1, 'Nike Air Force 1 LV8 3', 'The classic blocking on the upper, Air unit underfoot and unmistakable shape make the AF1 a sneaker staple that never misses.', '2679000.00', 69, '2026-03-21T10:17:39.793Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) VALUES (4, 3, 2, 'Jordan Tiempo Maestro Elite SE', 'Wreaking havoc on the defence requires total command of the ball. That''s why we designed every aspect of the Tiempo Maestro Elite to put you in complete control of every touch. Its all-new Techleather material, softer than natural leather, combines with a flexible Maestro360 plate to give you a glove-like fit no matter where the ball strikes.', '7759000.00', 89, '2026-03-21T10:14:03.709Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) VALUES (3, 3, 1, 'Air Force 1', 'Comfortable, durable and timeless – it''s number one for a reason. The Air Force 1 pairs its classic silhouette with synthetic leather for a crisp, clean look.', '3239000.00', 99, '2026-03-21T09:55:41.653Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) VALUES (9, 3, 1, 'Nike Air Force 1 ''07', 'Comfortable, durable and timeless—it''s number one for a reason. The classic ''80s construction pairs smooth leather with bold details for style that tracks whether you''re on court or on the go.', '2929000.00', 301, '2026-03-22T03:25:17.685Z');
INSERT INTO products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) VALUES (7, 4, 1, 'Jordan Flight Court', 'Inspired by the past, built for tomorrow. We remixed elements from the AJ3, AJ4 and AJ5 to create a fresh take on the classics. Smooth leather and soft suede give you style and durability while textile panels add breathability. Plus, embroidered details infuse these kicks with Jordan heritage.', '2920000.00', 112, '2026-03-21T19:23:59.520Z');

INSERT INTO product_images (id, product_id, image_url) VALUES (9, 3, '/uploads/1774112141537-AIR_FORCE_1__07.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (10, 4, '/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (11, 5, '/uploads/1774113369723-NIKE_AIR_WINFLO_12.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (12, 6, '/uploads/1774113459756-AIR_FORCE_1_LV8_3__GS_.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (13, 7, '/uploads/1774146239490-WMNS_JORDAN_FLIGHT_COURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (15, 9, '/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg');
INSERT INTO product_images (id, product_id, image_url) VALUES (16, 4, '/uploads/1774250380203-TIEMPO_MAESTRO_ELITE_FG_SE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (17, 4, '/uploads/1774250393091-TIEMPO_MAESTRO_ELITE_FE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (20, 3, '/uploads/1774270134911-2AIR_FORCE_1_07.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (21, 3, '/uploads/1774270145414-3AIR_FORCE_1_07.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (22, 9, '/uploads/1774270224201-1AIRFORCE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (23, 9, '/uploads/1774270234314-2AIRFORCE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (24, 7, '/uploads/1774270325819-1JORDANFLIGHTCOURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (25, 7, '/uploads/1774270335333-2JORDANFLIGHTCOURT.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (26, 5, '/uploads/1774270378856-1NIKEAIRWINFLO.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (27, 5, '/uploads/1774270425467-2NIKEAIRWINFLO.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (28, 6, '/uploads/1774270481761-1AIRFORCE.png');
INSERT INTO product_images (id, product_id, image_url) VALUES (29, 6, '/uploads/1774270490829-2AIRFORCE.png');

INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (1, 'admin', 'admin@theliemsshoes.com', '$2b$10$sTiIk4n4XaizP6EcDbNcr.klxWMrcxTVQ0cVY1YdaEW1k5Mv1gsyu', 'admin', NULL, '0901234567', NULL, '2026-03-20T00:42:46.985Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (2, 'Trần Hữu Lộc', 'customer1@gmail.com', '$2b$10$/RRgVyISLQM78Pn6bFWmBu3ChQiqC4jDIfZDlFR2pSUEiAfYPnCsy', 'customer', NULL, '0123456789', NULL, '2026-03-20T00:45:19.376Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (3, 'Lê Dương Anh Tuấn', 'customer2@gmail.com', '$2b$10$FYu8E.lRjHTuo0YyqJjw/OUo8I8BhzbIm3DlHn0OqRPjV4GglCQNi', 'customer', NULL, '0990123456', NULL, '2026-03-20T00:45:42.173Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (4, 'Lý Hậu Nghĩa', 'customer3@gmail.com', '$2b$10$ElnOX70rFUGKF41jenQ0zOfKocaP/o1KvOarC8I2AvcpBAHg9S8d2', 'customer', NULL, '0102030405', NULL, '2026-03-20T00:46:02.474Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (5, 'Tô Nhật Hào', 'customer4@gmail.com', '$2b$10$Czkj4tlym0VVsMltyJFX5.FUEKfM/wfyFImsGBH8MIMxkTuANLK3i', 'customer', NULL, '0990123456', NULL, '2026-03-20T00:46:22.568Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (6, 'Huỳnh Quang Thiện', 'customer6@gmail.com', '$2b$10$kyG5ZXEIlR/bguRNiulk.O.oxMyJVVS67Ndh0.Xm9jk5Jm5OQDkAK', 'customer', NULL, '0908070605', NULL, '2026-03-20T00:46:45.073Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (7, 'abc@gmail.com', 'asd@gmail.com', '$2b$10$k7O0CvzqQlj33Ev0i8xASey9SybgIGgEIzIKISg74HXWpZKHGfoUm', 'customer', NULL, '0923456789', NULL, '2026-03-23T06:08:38.370Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (8, 'nhathao0910', 'nhathao0910@gmail.com', '$2b$10$aRj3HDhR3qowsEOLZJQeluZU5s2gkODFOe4x4kGPGSwuKadjJkive', 'customer', NULL, '091020041234', NULL, '2026-03-23T19:49:46.609Z');
INSERT INTO users (id, username, email, password, role, full_name, phone_number, address, created_at) VALUES (9, 'a112121', 'a@gmail.com', '$2b$10$EFvwsNVZAvq79pTXDPpqbeq7rChkupIhJ8zOrgK6FwQE54gil144W', 'customer', NULL, '1', NULL, '2026-03-23T20:15:54.706Z');

-- Reset sequences after insert
SELECT setval('public.categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1), TRUE);
SELECT setval('public.product_type_id_seq', COALESCE((SELECT MAX(id) FROM product_type), 1), TRUE);
SELECT setval('public.products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1), TRUE);
SELECT setval('public.product_images_id_seq', COALESCE((SELECT MAX(id) FROM product_images), 1), TRUE);
SELECT setval('public.users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), TRUE);
SELECT setval('public.carts_id_seq', COALESCE((SELECT MAX(id) FROM carts), 1), TRUE);
SELECT setval('public.cart_items_id_seq', COALESCE((SELECT MAX(id) FROM cart_items), 1), TRUE);
SELECT setval('public.orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1), TRUE);
SELECT setval('public.order_items_id_seq', COALESCE((SELECT MAX(id) FROM order_items), 1), TRUE);
