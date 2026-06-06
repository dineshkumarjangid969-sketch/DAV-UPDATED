const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'dav_transport.db');
const BACKUP_PATH = DB_PATH + '.bak.' + Date.now();
const TARGET_ID = '123710';

function backupDb() {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('DB backup created at', BACKUP_PATH);
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function main() {
  const db = new sqlite3.Database(DB_PATH);
  try {
    const row = await dbGet(db, 'SELECT * FROM orders WHERE id = ?', [TARGET_ID]);
    if (!row) throw new Error('Order 123710 not found');

    const norm = parseJson(row.normalized_data, {});
    const attachments = parseJson(row.attachment_paths, []);

    const cleanProduct = {
      sku: 'SERBGMM-QUE',
      quantity: 1,
      description: 'SERTA BLUE LAGOON MED QUN MAT',
      source_order_id: '123710',
    };

    const cleanedLineItems = [cleanProduct];
    const cleanedProducts = [cleanProduct];

    const cleanedNorm = {
      ...norm,
      products: cleanedProducts,
      merged_from: Array.isArray(norm.merged_from) ? norm.merged_from : [],
      cleaned_products: true,
      cleaned_product_reason: 'Removed table/header OCR fragments and kept the actual BT item.',
    };

    console.log('Before:', JSON.stringify({ line_items: row.line_items, products: norm.products }, null, 2));
    console.log('After:', JSON.stringify({ line_items: cleanedLineItems, products: cleanedProducts }, null, 2));

    backupDb();
    await dbRun(db, 'BEGIN TRANSACTION');
    await dbRun(db, 'UPDATE orders SET line_items = ?, normalized_data = ?, attachment_paths = ? WHERE id = ?', [
      JSON.stringify(cleanedLineItems),
      JSON.stringify(cleanedNorm),
      JSON.stringify(attachments),
      TARGET_ID,
    ]);
    await dbRun(db, 'COMMIT');
    console.log('Cleaned order 123710 successfully.');
  } catch (err) {
    try { await dbRun(db, 'ROLLBACK'); } catch {}
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
