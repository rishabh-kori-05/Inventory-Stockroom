# Stockroom

A small inventory module I built for shops and wholesale counters that want to track stock without a full ERP. It runs on Node with a single SQLite file, so there is nothing to install besides Node itself and nothing to host.

It does the boring parts properly: every change in quantity is written to a ledger, so the number on the product always matches its history.

## What it does

- Products with SKU, category, supplier, unit, cost, selling price, rack/bin location and a reorder level
- Stock movements: opening stock, received, sold, customer return, damaged/lost, and stock-count corrections
- A ledger of every movement with the running balance after it
- Overview page: product count, stock value at cost and at selling price, low-stock and out-of-stock counts, and a short reorder list
- Search by name or SKU, filter by category or stock level
- Categories and suppliers
- CSV export of current stock
- Negative stock is refused (you get told how much is actually in stock)
- Removing a product that has history archives it instead of deleting it, so old ledger entries still make sense

## Running it

You need Node 18 or newer.

```
git clone <your-repo-url> stockroom
cd stockroom
npm install
npm run seed     # optional, adds a few sample items
npm start
```

Then open http://localhost:3000. The data lives in `inventory.db` next to the code. Back it up by copying that file.

`PORT` and `DB_FILE` environment variables change the port and database location.

## Layout

```
db.js        schema, and the one function that changes stock
server.js    REST API and static files
seed.js      sample data
public/      the UI (plain HTML, CSS and JS, no build step)
```

## API

| Method | Path | |
|---|---|---|
| GET | /api/summary | totals and reorder list |
| GET | /api/products?q=&category=&status=low\|out | list |
| POST / PUT / DELETE | /api/products[/:id] | create, edit, remove |
| GET / POST | /api/movements | ledger / record a movement |
| GET / POST | /api/categories | |
| GET / POST | /api/suppliers | |
| GET | /api/export/products.csv | |

A movement is `{ product_id, type, qty, note }` where type is one of `purchase`, `sale`, `return`, `damage`, `adjust`. For `adjust`, `qty` is the counted stock, not the difference.

## Not done yet

- Purchase orders and supplier invoices
- Batch / expiry tracking
- Barcode scanning
- CSV import
- Users and login. It assumes it is on a trusted machine or network, so put it behind something if you expose it.
- Multiple warehouses

## License

MIT
