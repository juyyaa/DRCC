/**
 * DRCC — Database connection pool (MariaDB via mysql2)
 */
'use strict';
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST || '127.0.0.1',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME || 'drcc_db',
  waitForConnections:  true,
  connectionLimit:    Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit:          0,
  dateStrings:         false,
  decimalNumbers:      true,
});

/** Quick query helper: returns rows directly */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Test connection on boot */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ MariaDB connected:', process.env.DB_NAME);
    return true;
  } catch (err) {
    console.error('❌ MariaDB connection failed:', err.message);
    return false;
  }
}

module.exports = { pool, query, testConnection };
