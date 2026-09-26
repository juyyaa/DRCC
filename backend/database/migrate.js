/**
 * DRCC — Migration Runner
 * Menjalankan schema.sql ke database yang dikonfigurasi di .env
 * Jalankan: node database/migrate.js
 */
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
  const dbName = process.env.DB_NAME || 'drcc_db';
  console.log(`📦 Menjalankan migrasi ke database '${dbName}'...\n`);

  // Connect WITHOUT specifying database first, to create it if not exists
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  await connection.query(schema);
  console.log('✅ Schema berhasil diterapkan.\n');

  const [tables] = await connection.query('SHOW TABLES;');
  console.log(`📋 ${tables.length} tabel tersedia:`);
  tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));

  await connection.end();
  console.log('\n🎉 Migrasi selesai! Jalankan "npm run seed" untuk membuat user default.\n');
}

migrate().catch(err => {
  console.error('❌ Migrasi gagal:', err.message);
  process.exit(1);
});
