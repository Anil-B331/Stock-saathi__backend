/**
 * Bootstrap script: promote an existing user (or create one) to Super Admin.
 *
 * Usage:
 *   # Promote an existing user by email (recommended — they keep their password):
 *   node scripts/seedAdmin.js promote alice@test.com
 *
 *   # Create a brand-new superadmin (use only if no user exists yet):
 *   node scripts/seedAdmin.js create admin@stocksaathi.com "StockSathi Admin" "StrongPass!23"
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const userModel = require('../src/models/userModel');

const [, , action, ...args] = process.argv;

async function promote(email) {
  if (!email) {
    console.error('Usage: node scripts/seedAdmin.js promote <email>');
    process.exit(1);
  }
  const user = await userModel.promoteToSuperAdmin(email.toLowerCase());
  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`✅ Promoted ${user.email} to superadmin (status: ${user.status}).`);
  console.log('   You can now log in to /admin with this account.');
}

async function create(email, name, password) {
  if (!email || !name || !password) {
    console.error('Usage: node scripts/seedAdmin.js create <email> <name> <password>');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('❌ Password must be at least 6 characters.');
    process.exit(1);
  }
  const existing = await userModel.getUserByEmail(email.toLowerCase());
  if (existing) {
    console.error(`❌ A user with email ${email} already exists. Use 'promote' instead.`);
    process.exit(1);
  }
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const user = await userModel.createUser(
    name,
    email.toLowerCase(),
    passwordHash,
    'superadmin',
    null,
    'NPR',
    'en',
    'approved'
  );
  console.log(`✅ Created superadmin ${user.email}. Log in at /admin to start approving shops.`);
}

async function main() {
  try {
    if (action === 'promote') {
      await promote(args[0]);
    } else if (action === 'create') {
      await create(args[0], args[1], args[2]);
    } else {
      console.log('StockSathi Super-Admin Seeder\n');
      console.log('Commands:');
      console.log('  node scripts/seedAdmin.js promote <email>');
      console.log('  node scripts/seedAdmin.js create <email> <name> <password>');
      process.exit(1);
    }
  } catch (err) {
    console.error('Seeder failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
