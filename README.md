# Stockroom — Inventory Management

A lightweight inventory application for shops and wholesale counters. It uses Node.js and SQLite and records stock changes in a movement ledger.

## Features

- Product records with SKU, category, supplier, unit, pricing and reorder level
- Stock movements for purchases, sales, returns, damage and adjustments
- Movement ledger with running balances
- Low-stock and out-of-stock overview
- Product search and category filtering
- Supplier and category management
- CSV export
- Prevents negative stock
- Archives products with movement history instead of deleting their history

## Tech stack

- Node.js
- SQLite
- REST API
- HTML, CSS and vanilla JavaScript

## Run locally

Requirements: Node.js 18+ and npm.

```bash
git clone https://github.com/rishabh-kori-05/Inventory-Stockroom.git
cd Inventory-Stockroom
npm install
npm run seed
npm start
```

Open `http://localhost:3000` in your browser. Seeding is optional and adds sample inventory records.

## Configuration

- `PORT` changes the server port.
- `DB_FILE` changes the SQLite database file location.

The application stores data in a local SQLite database. Back up the database file before making changes to a working installation.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/summary` | Inventory totals and reorder list |
| GET | `/api/products` | List and filter products |
| POST / PUT / DELETE | `/api/products[/:id]` | Manage products |
| GET / POST | `/api/movements` | Read or record stock movements |
| GET / POST | `/api/categories` | Manage categories |
| GET / POST | `/api/suppliers` | Manage suppliers |
| GET | `/api/export/products.csv` | Export products |

A movement contains `product_id`, `type`, `qty` and an optional `note`. For an `adjust` movement, `qty` is the counted stock quantity.

## Current limitations

The current project does not include purchase orders, supplier invoices, batch/expiry tracking, barcode scanning, CSV import, user authentication or multi-warehouse support. It is intended for a trusted local environment; do not expose it directly to an untrusted network without adding appropriate access controls.

## Project structure

```text
db.js       Database schema and stock update logic
server.js   REST API and static file server
seed.js     Optional sample data
public/     Frontend files
```

## License

MIT. See [LICENSE](./LICENSE).
