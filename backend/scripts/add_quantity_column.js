const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB = path.join(__dirname, '..', 'dav_transport.db');
const BACKUP = DB + '.bak.' + Date.now();

function columnExists(db, table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.some(r => r.name === column));
    });
  });
}

function backupDb() {
  fs.copyFileSync(DB, BACKUP);
  console.log('DB backed up to', BACKUP);
}

function parseQuantityFromText(text) {
  if (!text) return null;
  // common patterns: ' x1', ' x 1', 'Qty: 1', 'QTY 1', '1 x'
  const patterns = [ /x\s*(\d+)\b/i, /\b(\d+)\s*x\b/i, /qty[:\s]*([0-9]+)/i, /quantity[:\s]*([0-9]+)/i, /\b(\d+)\b/ ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return parseInt(m[1], 10);
  }
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = new sqlite3.Database(DB);
  try {
    const exists = await columnExists(db, 'orders', 'quantity');
    if (!exists) {
      console.log('`quantity` column does not exist');
      if (apply) {
        backupDb();
        await new Promise((res, rej) => db.run('ALTER TABLE orders ADD COLUMN quantity INTEGER', [], err => err ? rej(err) : res()));
        console.log('Added `quantity` column');
      } else {
        console.log('Dry-run: would add `quantity` column');
      }
    } else {
      console.log('`quantity` column already exists');
    }

    let rows;
    if (exists) {
      rows = await new Promise((resolve, reject) => {
        db.all("SELECT id, line_items, normalized_data FROM orders WHERE quantity IS NULL OR quantity = ''", [], (err, r) => err ? reject(err) : resolve(r || []));
      });
    } else {
      rows = await new Promise((resolve, reject) => {
        db.all("SELECT id, line_items, normalized_data FROM orders", [], (err, r) => err ? reject(err) : resolve(r || []));
      });
    }

    const updates = [];
    for (const r of rows) {
      let qty = null;
      // try line_items as JSON
      try {
        const li = typeof r.line_items === 'string' ? JSON.parse(r.line_items) : r.line_items;
        if (Array.isArray(li) && li.length === 1 && li[0].qty) qty = parseInt(li[0].qty, 10);
      } catch (e) {
        // ignore
      }
      if (!qty) {
        // try normalized_data
        try {
          const nd = typeof r.normalized_data === 'string' ? JSON.parse(r.normalized_data) : r.normalized_data;
          if (nd && nd.products && Array.isArray(nd.products) && nd.products.length === 1 && nd.products[0].quantity) qty = parseInt(nd.products[0].quantity, 10);
        } catch (e) {}
      }
      if (!qty) {
        // fallback: scan text fields
        const text = (r.line_items || '') + ' ' + (r.normalized_data || '');
        qty = parseQuantityFromText(String(text));
      }
      if (qty && !isNaN(qty)) updates.push({ id: r.id, qty });
    }

    console.log('Found', updates.length, 'rows with inferred quantity');
    for (const u of updates) console.log('  id:', u.id, 'qty:', u.qty);

    if (apply && updates.length > 0) {
      const stmt = db.prepare('UPDATE orders SET quantity = ? WHERE id = ?');
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        for (const u of updates) stmt.run(u.qty, u.id);
        stmt.finalize();
        db.run('COMMIT');
      });
      console.log('Applied', updates.length, 'updates');
    } else if (!apply) {
      console.log('Dry-run complete. To apply, re-run with --apply');
    }
  } catch (e) {
    console.error(e);
  } finally {
    db.close();
  }
}

main();
