--
-- PostgreSQL database dump
--

\restrict mxaaRyNFVh5lyCRdK2vjx8lCE40iwZCUh740963OhXipd8Zr9ihHs81Q44XiuLd

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg12+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: theliems
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO theliems;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    cart_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer DEFAULT 1
);


ALTER TABLE public.cart_items OWNER TO theliems;

--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cart_items_id_seq OWNER TO theliems;

--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: carts; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.carts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.carts OWNER TO theliems;

--
-- Name: carts_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.carts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carts_id_seq OWNER TO theliems;

--
-- Name: carts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    category_name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.categories OWNER TO theliems;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO theliems;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL
);


ALTER TABLE public.order_items OWNER TO theliems;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO theliems;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total_amount numeric(10,2),
    status character varying(30) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.orders OWNER TO theliems;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO theliems;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    image_url text NOT NULL
);


ALTER TABLE public.product_images OWNER TO theliems;

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_images_id_seq OWNER TO theliems;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_type; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.product_type (
    id integer NOT NULL,
    type_name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.product_type OWNER TO theliems;

--
-- Name: product_type_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.product_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_type_id_seq OWNER TO theliems;

--
-- Name: product_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.product_type_id_seq OWNED BY public.product_type.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.products (
    id integer NOT NULL,
    category_id integer,
    product_type_id integer,
    product_name character varying(200) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    stock_quantity integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.products OWNER TO theliems;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO theliems;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: theliems
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    role character varying(20) DEFAULT 'customer'::character varying,
    full_name character varying(100),
    phone_number character varying(20),
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO theliems;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: theliems
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO theliems;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: theliems
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: carts id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_type id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.product_type ALTER COLUMN id SET DEFAULT nextval('public.product_type_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.cart_items (id, cart_id, product_id, quantity) FROM stdin;
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.carts (id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.categories (id, category_name, description) FROM stdin;
3	Men	Shoes designed for men, including formal, casual, and sports styles.
4	Women	Shoes designed for women, including heels, flats, sneakers, and sandals.
5	Children	Shoes designed for kids, focusing on comfort, durability, and safety.
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.order_items (id, order_id, product_id, quantity, price) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.orders (id, user_id, total_amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.product_images (id, product_id, image_url) FROM stdin;
9	3	/uploads/1774112141537-AIR_FORCE_1__07.jpg
10	4	/uploads/1774113243689-TIEMPO_MAESTRO_ELITE_FG_SE.jpg
11	5	/uploads/1774113369723-NIKE_AIR_WINFLO_12.png
12	6	/uploads/1774113459756-AIR_FORCE_1_LV8_3__GS_.png
13	7	/uploads/1774146239490-WMNS_JORDAN_FLIGHT_COURT.png
15	9	/uploads/1774175117658-AIR_FORCE_1__07_TECH_ESS.jpg
16	4	/uploads/1774250380203-TIEMPO_MAESTRO_ELITE_FG_SE.png
17	4	/uploads/1774250393091-TIEMPO_MAESTRO_ELITE_FE.png
\.


--
-- Data for Name: product_type; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.product_type (id, type_name, description) FROM stdin;
1	Fashion	Stylish footwear designed to complement modern outfits and express personal fashion sense.
2	Football	Specialized shoes engineered for optimal traction, control, and performance on the football field.
3	Running	Lightweight and cushioned footwear built to provide comfort and support during running activities.
4	Basketball	High-performance shoes designed for ankle support, grip, and agility on the basketball court.
5	Tennis	Durable and stable footwear crafted for quick lateral movements on tennis courts.
6	Skateboarding	Rugged shoes with flat soles for better board control and durability during skateboarding.
7	Hiking	Sturdy footwear designed to provide traction, support, and protection on outdoor trails.
8	Casual	Comfortable everyday shoes suitable for relaxed, daily wear and versatile use.
9	Sandals	Open-toe footwear designed for breathability and comfort in warm weather.
10	Boots	Durable footwear offering enhanced protection, support, and style for various conditions.
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.products (id, category_id, product_type_id, product_name, description, price, stock_quantity, created_at) FROM stdin;
3	3	1	Air Force 1	Comfortable, durable and timeless – it's number one for a reason. The Air Force 1 pairs its classic silhouette with synthetic leather for a crisp, clean look.	3239000.00	99	2026-03-21 16:55:41.65376
5	4	3	Nike Winflo 12	Built with a Nike Air unit and a thick stack of Cushlon 3.0 foam, the Winflo 12 is the perfect combination of enhanced responsiveness and consistent cushioning. Breathable mesh up top and an accommodating fit help you feel locked in and ready to push for that extra mile.	3089000.00	91	2026-03-21 17:16:09.740095
6	5	1	Nike Air Force 1 LV8 3	The classic blocking on the upper, Air unit underfoot and unmistakable shape make the AF1 a sneaker staple that never misses.	2679000.00	69	2026-03-21 17:17:39.793198
7	4	1	Jordan Flight Court	Inspired by the past, built for tomorrow. We remixed elements from the AJ3, AJ4 and AJ5 to create a fresh take on the classics. Smooth leather and soft suede give you style and durability while textile panels add breathability. Plus, embroidered details infuse these kicks with Jordan heritage.	2920000.00	112	2026-03-22 02:23:59.520768
9	3	1	Nike Air Force 1 '07	Comfortable, durable and timeless—it's number one for a reason. The classic '80s construction pairs smooth leather with bold details for style that tracks whether you're on court or on the go.	2929000.00	301	2026-03-22 10:25:17.685091
4	3	2	Jordan Tiempo Maestro Elite SE	Wreaking havoc on the defence requires total command of the ball. That's why we designed every aspect of the Tiempo Maestro Elite to put you in complete control of every touch. Its all-new Techleather material, softer than natural leather, combines with a flexible Maestro360 plate to give you a glove-like fit no matter where the ball strikes.	7759000.00	89	2026-03-21 17:14:03.709048
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: theliems
--

COPY public.users (id, username, email, password, role, full_name, phone_number, address, created_at) FROM stdin;
1	admin	admin@theliemsshoes.com	$2b$10$sTiIk4n4XaizP6EcDbNcr.klxWMrcxTVQ0cVY1YdaEW1k5Mv1gsyu	admin	\N	0901234567	\N	2026-03-20 07:42:46.985592
2	Trần Hữu Lộc	customer1@gmail.com	$2b$10$/RRgVyISLQM78Pn6bFWmBu3ChQiqC4jDIfZDlFR2pSUEiAfYPnCsy	customer	\N	0123456789	\N	2026-03-20 07:45:19.376845
3	Lê Dương Anh Tuấn	customer2@gmail.com	$2b$10$FYu8E.lRjHTuo0YyqJjw/OUo8I8BhzbIm3DlHn0OqRPjV4GglCQNi	customer	\N	0990123456	\N	2026-03-20 07:45:42.173162
4	Lý Hậu Nghĩa	customer3@gmail.com	$2b$10$ElnOX70rFUGKF41jenQ0zOfKocaP/o1KvOarC8I2AvcpBAHg9S8d2	customer	\N	0102030405	\N	2026-03-20 07:46:02.474175
5	Tô Nhật Hào	customer4@gmail.com	$2b$10$Czkj4tlym0VVsMltyJFX5.FUEKfM/wfyFImsGBH8MIMxkTuANLK3i	customer	\N	0990123456	\N	2026-03-20 07:46:22.568152
6	Huỳnh Quang Thiện	customer6@gmail.com	$2b$10$kyG5ZXEIlR/bguRNiulk.O.oxMyJVVS67Ndh0.Xm9jk5Jm5OQDkAK	customer	\N	0908070605	\N	2026-03-20 07:46:45.07324
\.


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 1, false);


--
-- Name: carts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.carts_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.categories_id_seq', 5, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.order_items_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.product_images_id_seq', 17, true);


--
-- Name: product_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.product_type_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.products_id_seq', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: theliems
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- Name: cart_items cart_items_cart_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_product_id_key UNIQUE (cart_id, product_id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_type product_type_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.product_type
    ADD CONSTRAINT product_type_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: theliems
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO theliems;


--
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO theliems;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO theliems;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO theliems;


--
-- PostgreSQL database dump complete
--

\unrestrict mxaaRyNFVh5lyCRdK2vjx8lCE40iwZCUh740963OhXipd8Zr9ihHs81Q44XiuLd

