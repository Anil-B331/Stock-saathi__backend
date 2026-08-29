/**
 * seed-superadmin.js
 * ─────────────────────────────────────────────────────────────────
 * Creates a super-admin account OR promotes an existing user to
 * superadmin. Run once after deployment.
 *
 * Usage:
 *   node scripts/seed-superadmin.js
 *
 * Environment variables (read from .env):
 *   SUPERADMIN_EMAIL    — e.g. admin@stocksaathi.com
 *   SUPERADMIN_PASSWORD — e.g. MySecurePass123
 *   SUPERADMIN_NAME     — e.g. StockSathi Admin
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const EMAIL    = process.env.SUPERADMIN_EMAIL    || 'admin@stocksaathi.com';
const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Admin@1234';
const NAME     = process.env.SUPERADMIN_NAME     || 'StockSathi Admin';

async function seed() {
  try {
    console.log('\n🔐  StockSathi — Superadmin Seeder\n');

    // 1. Check if user already exists
    const existing = await pool.query(
      'SELECT id, name, email, role, status FROM users WHERE email = $1',
      [EMAIL.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      if (u.role === 'superadmin') {
        console.log(`✅  Superadmin already exists: ${u.name} <${u.email}>`);
        return;
      }
      // Promote existing account
      const promoted = await pool.query(
        `UPDATE users
           SET role = 'superadmin', status = 'approved'
         WHERE email = $1
         RETURNING id, name, email, role, status`,
        [EMAIL.trim().toLowerCase()]
      );
      const p = promoted.rows[0];
      console.log(`⬆️   Promoted existing user to superadmin:`);
      console.log(`    Name:  ${p.name}`);
      console.log(`    Email: ${p.email}`);
      console.log(`    Role:  ${p.role}`);
      return;
    }

    // 2. Create brand-new superadmin account
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(PASSWORD, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status, currency, language)
       VALUES ($1, $2, $3, 'superadmin', 'approved', 'NPR', 'en')
       RETURNING id, name, email, role, status`,
      [NAME.trim(), EMAIL.trim().toLowerCase(), hash]
    );

    const newAdmin = result.rows[0];
    console.log(`🎉  Superadmin created successfully!`);
    console.log(`    Name:     ${newAdmin.name}`);
    console.log(`    Email:    ${newAdmin.email}`);
    console.log(`    Password: ${PASSWORD}`);
    console.log(`    Role:     ${newAdmin.role}`);
    console.log(`\n⚠️   Keep these credentials safe and change the password after first login.\n`);
  } catch (err) {
    console.error('❌  Seeder failed:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

seed();
