// npm run seed  -- fills an empty database with a few sample items
const { db, move } = require('./db');

if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n) {
  console.log('Database already has products, skipping.');
  process.exit(0);
}
const cat = n => db.prepare('INSERT INTO categories (name) VALUES (?)').run(n).lastInsertRowid;
const sup = (n, p) => db.prepare('INSERT INTO suppliers (name, phone) VALUES (?,?)').run(n, p).lastInsertRowid;

const grocery = cat('Grocery'), stationery = cat('Stationery'), hardware = cat('Hardware');
const a = sup('Shah Traders', '98200 00001'), b = sup('Patel Wholesale', '98200 00002');

const add = (sku, name, c, s, unit, cost, price, reorder, loc, qty) => {
  const id = db.prepare(`INSERT INTO products (sku,name,category_id,supplier_id,unit,cost,price,reorder_level,location)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(sku, name, c, s, unit, cost, price, reorder, loc).lastInsertRowid;
  if (qty) move(id, 'opening', qty, 'Opening stock');
  return id;
};
add('GR-001', 'Basmati rice 5kg', grocery, a, 'bag', 410, 480, 10, 'Rack A1', 24);
add('GR-002', 'Sunflower oil 1L', grocery, a, 'pcs', 128, 150, 20, 'Rack A2', 8);
add('ST-010', 'A4 notebook, 200pg', stationery, b, 'pcs', 38, 55, 30, 'Rack B1', 60);
add('ST-011', 'Gel pen, blue', stationery, b, 'box', 90, 130, 5, 'Rack B2', 0);
add('HW-100', 'Wall plug 8mm (100)', hardware, b, 'pack', 62, 90, 12, 'Bin C4', 15);
console.log('Seeded.');
