require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const rs = await pool.query("SELECT id, image_url FROM product_images ORDER BY id");
    const uploadDir = path.join(process.cwd(), "uploads");
    const check = rs.rows.map(r => {
      const fileName = path.basename(r.image_url || "");
      return { id: r.id, image_url: r.image_url, exists_exact: fs.existsSync(path.join(uploadDir, fileName)) };
    });
    console.log(JSON.stringify(check));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
