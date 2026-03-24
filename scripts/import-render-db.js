const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const sqlFilePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '..', 'theliemsshoes_postgres.sql');

  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`SQL file not found: ${sqlFilePath}`);
  }

  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`Importing SQL file: ${sqlFilePath}`);
    await pool.query(sql);

    const countQuery = `
      SELECT 'users' AS table_name, COUNT(*)::int AS total FROM users
      UNION ALL SELECT 'products', COUNT(*)::int FROM products
      UNION ALL SELECT 'sizes', COUNT(*)::int FROM sizes
      UNION ALL SELECT 'product_sizes', COUNT(*)::int FROM product_sizes
      UNION ALL SELECT 'carts', COUNT(*)::int FROM carts
      UNION ALL SELECT 'cart_items', COUNT(*)::int FROM cart_items
      UNION ALL SELECT 'orders', COUNT(*)::int FROM orders
      UNION ALL SELECT 'order_items', COUNT(*)::int FROM order_items
      UNION ALL SELECT 'coupons', COUNT(*)::int FROM coupons
      UNION ALL SELECT 'user_coupons', COUNT(*)::int FROM user_coupons
      ORDER BY table_name;
    `;

    const counts = await pool.query(countQuery);
    console.log('Import completed successfully.');
    console.table(counts.rows);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exitCode = 1;
});
