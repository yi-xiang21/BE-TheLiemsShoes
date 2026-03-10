const { Pool } = require('pg');

// Sử dụng DATABASE_URL từ environment variable (Render sẽ tự set)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required cho Render PostgreSQL
  },
  max: 10, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.connect()
  .then(client => {
    console.log('✓ Kết nối PostgreSQL database thành công!');
    client.release();
  })
  .catch(err => {
    console.error('✗ Lỗi kết nối PostgreSQL database:', err.message);
  });

module.exports = pool;
