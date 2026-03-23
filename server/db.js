const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const q  = async (sql, p=[]) => (await pool.query(sql, p)).rows;
const q1 = async (sql, p=[]) => (await pool.query(sql, p)).rows[0] || null;

module.exports = { pool, q, q1 };
