/**
 * DRCC — Database Seed Script
 * Membuat 4 user default + 7 definisi sinyal awal.
 * Jalankan: node database/seed.js
 */
'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/db');

const USERS = [
  { username: process.env.SEED_ADMIN_USERNAME || 'admin', password: process.env.SEED_ADMIN_PASSWORD || 'admin123', role: 'admin',    name: process.env.SEED_ADMIN_NAME || 'Administrator BNPB', email: 'admin@drcc.id' },
  { username: 'operator', password: 'op123',  role: 'operator', name: 'Operator BNPB',     email: 'operator@drcc.id' },
  { username: 'relawan',  password: 'rel123', role: 'relawan',  name: 'Relawan Lapangan',  email: 'relawan@drcc.id' },
  { username: 'pemda',    password: 'pem123', role: 'pemda',    name: 'Pemda DKI Jakarta', email: 'pemda@drcc.id', province: 'DKI Jakarta' },
];

const SIGNALS = [
  { id:'SIG-001', name:'Seismograf',           type:'gempa',       unit:'SR',    source:'BMKG' },
  { id:'SIG-002', name:'Muka Air Sungai',       type:'banjir',      unit:'cm',    source:'PUSAIR' },
  { id:'SIG-003', name:'Cuaca/Curah Hujan',     type:'cuaca',       unit:'mm/h',  source:'BMKG KLIM' },
  { id:'SIG-004', name:'Kecepatan Angin',       type:'angin',       unit:'km/h',  source:'AWS BMKG' },
  { id:'SIG-005', name:'Relawan Lapangan',      type:'relawan',     unit:'orang', source:'BNPB' },
  { id:'SIG-006', name:'Kapasitas Pengungsian', type:'pengungsian', unit:'%',     source:'BPBD' },
  { id:'SIG-007', name:'Suhu Udara',            type:'kebakaran',   unit:'°C',    source:'BMKG' },
];

async function seed() {
  console.log('🌱 Seeding database...\n');

  for (const u of USERS) {
    const existing = await query('SELECT id FROM users WHERE username = ?', [u.username]);
    if (existing.length) {
      console.log(`⏭  User '${u.username}' sudah ada, skip.`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    await query(
      'INSERT INTO users (username, password_hash, role, name, email, province) VALUES (?,?,?,?,?,?)',
      [u.username, hash, u.role, u.name, u.email, u.province || null]
    );
    console.log(`✅ User created: ${u.username} / ${u.password} (${u.role})`);
  }

  console.log('');
  for (const s of SIGNALS) {
    const existing = await query('SELECT id FROM signals WHERE id = ?', [s.id]);
    if (existing.length) { console.log(`⏭  Signal '${s.id}' sudah ada, skip.`); continue; }
    await query('INSERT INTO signals (id, name, type, unit, source) VALUES (?,?,?,?,?)', [s.id, s.name, s.type, s.unit, s.source]);
    console.log(`✅ Signal created: ${s.id} — ${s.name}`);
  }

  console.log('\n🎉 Seeding selesai!\n');
  console.log('Demo credentials:');
  USERS.forEach(u => console.log(`  ${u.role.padEnd(10)} → ${u.username} / ${u.password}`));

  await pool.end();
}

seed().catch(err => {
  console.error('❌ Seed gagal:', err);
  process.exit(1);
});
