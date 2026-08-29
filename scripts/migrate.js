const { pool } = require('../src/db');

const migrate = async () => {
  try {
    console.log('Running migrations...');
    
    // Drop old role check constraint so 'superadmin' role is allowed
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'owner',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        currency VARCHAR(10) DEFAULT 'NPR',
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure all columns exist for existing databases
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NPR';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
    `);

    // Superadmins are auto-approved; update role CHECK constraint safely
    await pool.query(`
      UPDATE users SET status = 'approved' WHERE role = 'superadmin' AND status = 'pending';
    `);

    console.log('users table created or updated with phone, currency, language, and status.');


    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100),
        sku VARCHAR(100) UNIQUE,
        quantity INTEGER DEFAULT 0,
        category VARCHAR(100),
        cost_price DECIMAL(10, 2),
        sale_price DECIMAL(10, 2),
        photo_url TEXT,
        low_stock_threshold INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Ensure low_stock_threshold and brand exist if items table was created previously
    await pool.query(`
      ALTER TABLE items ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
    `);
    console.log('items table created or updated with low_stock_threshold and brand.');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_logs (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
        quantity_changed INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('stock_logs table created or already exists.');

    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.code === 'ENETUNREACH') {
      console.error('\n💡 HINT: Render free tier does not support IPv6.');
      console.error('In Supabase -> Project Settings -> Database -> Connection Pooling, copy the Pooler connection string (port 6543 / 5432) which supports IPv4.\n');
    }
  } finally {
    pool.end();
  }
};

migrate();
