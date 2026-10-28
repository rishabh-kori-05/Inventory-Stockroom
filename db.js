const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_FILE || path.join(__dirname, 'inventory.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  unit TEXT DEFAULT 'pcs',
  cost REAL DEFAULT 0,
  price REAL DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  location TEXT,
  qty INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  qty INTEGER NOT NULL,      -- signed change
  balance INTEGER NOT NULL,  -- stock after this movement
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mov_product ON movements(product_id);
`);

const SIGN = { opening: 1, purchase: 1, return: 1, sale: -1, damage: -1 };

// Every stock change goes through here so qty and the ledger can't drift apart.
const move = db.transaction((productId, type, qty, note) => {
  const p = db.prepare('SELECT qty FROM products WHERE id = ? AND active = 1').get(productId);
  if (!p) throw new Error('Product not found');
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Quantity must be a whole number, 0 or more');

  let delta;
  if (type === 'adjust') delta = qty - p.qty; // qty = counted stock
  else if (SIGN[type]) delta = SIGN[type] * qty;
  else throw new Error('Unknown movement type');

  const balance = p.qty + delta;
  if (balance < 0) throw new Error(`Only ${p.qty} in stock`);

  db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(balance, productId);
  db.prepare('INSERT INTO movements (product_id, type, qty, balance, note) VALUES (?,?,?,?,?)')
    .run(productId, type, delta, balance, note || null);
});

module.exports = { db, move };
