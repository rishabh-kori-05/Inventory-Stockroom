const express = require('express');
const path = require('path');
const { db, move } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// tiny wrapper: send result as JSON, turn thrown errors into 400s
const h = fn => (req, res) => {
  try { res.json(fn(req)); }
  catch (e) {
    const msg = /UNIQUE/.test(e.message) ? 'That SKU or name already exists' : e.message;
    res.status(400).json({ error: msg });
  }
};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const SELECT = `
  SELECT p.*, c.name AS category, s.name AS supplier
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id`;

function fields(b) {
  const sku = String(b.sku || '').trim();
  const name = String(b.name || '').trim();
  if (!sku || !name) throw new Error('SKU and name are required');
  return [sku, name, b.category_id || null, b.supplier_id || null, b.unit || 'pcs',
    num(b.cost), num(b.price), Math.trunc(num(b.reorder_level)), b.location || null];
}

app.get('/api/summary', h(() => ({
  ...db.prepare(`
    SELECT COUNT(*) AS skus,
           COALESCE(SUM(qty * cost), 0) AS cost_value,
           COALESCE(SUM(qty * price), 0) AS retail_value,
           COALESCE(SUM(qty > 0 AND qty <= reorder_level), 0) AS low,
           COALESCE(SUM(qty <= 0), 0) AS out
    FROM products WHERE active = 1`).get(),
  reorder: db.prepare(`${SELECT} WHERE p.active = 1 AND p.qty <= p.reorder_level
                       ORDER BY p.qty, p.name LIMIT 10`).all(),
})));

app.get('/api/products', h(req => {
  const { q = '', category = '', status = '' } = req.query;
  const where = ['p.active = 1'], args = [];
  if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (category) { where.push('p.category_id = ?'); args.push(category); }
  if (status === 'low') where.push('p.qty > 0 AND p.qty <= p.reorder_level');
  if (status === 'out') where.push('p.qty <= 0');
  return db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY p.name`).all(...args);
}));

app.post('/api/products', h(req => {
  const f = fields(req.body);
  return db.transaction(() => {
    const id = db.prepare(`INSERT INTO products
      (sku, name, category_id, supplier_id, unit, cost, price, reorder_level, location)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(...f).lastInsertRowid;
    const opening = Math.trunc(num(req.body.qty));
    if (opening > 0) move(id, 'opening', opening, 'Opening stock');
    return { id };
  })();
}));

app.put('/api/products/:id', h(req => {
  db.prepare(`UPDATE products SET sku=?, name=?, category_id=?, supplier_id=?, unit=?,
    cost=?, price=?, reorder_level=?, location=? WHERE id=?`).run(...fields(req.body), req.params.id);
  return { ok: true };
}));

// products with history are archived, never hard-deleted, so the ledger stays readable
app.delete('/api/products/:id', h(req => {
  const used = db.prepare('SELECT 1 FROM movements WHERE product_id = ?').get(req.params.id);
  if (used) db.prepare("UPDATE products SET active = 0, sku = sku || '~' || id WHERE id = ?").run(req.params.id);
  else db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  return { ok: true };
}));

app.get('/api/movements', h(req => {
  const pid = req.query.product_id;
  return db.prepare(`SELECT m.*, p.name, p.sku, p.unit FROM movements m
    JOIN products p ON p.id = m.product_id
    ${pid ? 'WHERE m.product_id = ?' : ''}
    ORDER BY m.id DESC LIMIT 200`).all(...(pid ? [pid] : []));
}));

app.post('/api/movements', h(req => {
  const { product_id, type, qty, note } = req.body;
  move(Number(product_id), type, Math.trunc(num(qty, -1)), note);
  return { ok: true };
}));

app.get('/api/categories', h(() => db.prepare('SELECT * FROM categories ORDER BY name').all()));
app.post('/api/categories', h(req => {
  const name = String(req.body.name || '').trim();
  if (!name) throw new Error('Category name is required');
  db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  return { ok: true };
}));

app.get('/api/suppliers', h(() => db.prepare('SELECT * FROM suppliers ORDER BY name').all()));
app.post('/api/suppliers', h(req => {
  const { name, phone, email } = req.body;
  if (!String(name || '').trim()) throw new Error('Supplier name is required');
  db.prepare('INSERT INTO suppliers (name, phone, email) VALUES (?,?,?)').run(name.trim(), phone || null, email || null);
  return { ok: true };
}));

app.get('/api/export/products.csv', (req, res) => {
  const rows = db.prepare(`${SELECT} WHERE p.active = 1 ORDER BY p.sku`).all();
  const cols = ['sku', 'name', 'category', 'supplier', 'unit', 'cost', 'price', 'qty', 'reorder_level', 'location'];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="stock.csv"' }).send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stockroom running on http://localhost:${PORT}`));
