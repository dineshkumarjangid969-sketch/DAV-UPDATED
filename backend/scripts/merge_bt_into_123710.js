const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'dav_transport.db');
const BACKUP_PATH = DB_PATH + '.bak.' + Date.now();

const TARGET_ID = '123710';
const SOURCE_IDS = ['BT_59c158c6', 'BT_60fa36d8', 'BT_a2c57f26', 'BT_c6407efd', 'BT_5516a620'];

function backupDb() {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('DB backup created at', BACKUP_PATH);
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
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

async function hasColumn(db, table, column) {
  const rows = await dbAll(db, `PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergeProducts(existing, incoming) {
  const items = [...existing, ...incoming].map(item => ({
    sku: item.sku || item.product || item.code || '',
    quantity: Number(item.quantity || item.qty || 1) || 1,
    description: item.description || item.name || '',
    price: item.price,
    source_order_id: item.source_order_id,
  }));
  return uniqBy(items, item => [item.sku, item.description, item.price, item.quantity].join('|'));
}

async function main() {
  const db = new sqlite3.Database(DB_PATH);
  try {
    const target = await dbGet(db, 'SELECT * FROM orders WHERE id = ?', [TARGET_ID]);
    if (!target) {
      console.error('Target order not found:', TARGET_ID);
      process.exit(1);
    }

    const sources = await dbAll(db, `SELECT * FROM orders WHERE id IN (${SOURCE_IDS.map(() => '?').join(',')})`, SOURCE_IDS);
    if (sources.length !== SOURCE_IDS.length) {
      console.error('One or more source orders were not found. Found:', sources.map(s => s.id));
      process.exit(1);
    }

    console.log('Target row before merge:');
    console.log({ id: target.id, order_number: target.order_number, invoice_number: target.invoice_number, bt_from: target.bt_from, bt_to: target.bt_to, quantity: target.quantity, email_subject: target.email_subject });

    const hasQuantityColumn = await hasColumn(db, 'orders', 'quantity');
    const targetLineItems = parseJson(target.line_items, []);
    const targetNorm = parseJson(target.normalized_data, {});
    const targetAttachments = parseJson(target.attachment_paths, []);

    const mergedLineItems = [...targetLineItems];
    const mergedProducts = [...(Array.isArray(targetNorm.products) ? targetNorm.products : [])];
    let mergedQuantity = Number(target.quantity || 0) || 0;
    const mergedAttachments = [...targetAttachments];

    for (const src of sources) {
      const srcLineItems = parseJson(src.line_items, []);
      const srcNorm = parseJson(src.normalized_data, {});
      const srcAttachments = parseJson(src.attachment_paths, []);

      for (const li of srcLineItems) {
        mergedLineItems.push({ ...li, source_order_id: src.id });
        mergedQuantity += Number(li.quantity || li.qty || 1) || 1;
      }

      const srcProducts = Array.isArray(srcNorm.products) ? srcNorm.products : [];
      for (const p of srcProducts) {
        mergedProducts.push({ ...p, source_order_id: src.id });
      }

      for (const att of srcAttachments) {
        mergedAttachments.push(att);
      }

      // if source has a quantity column but no line_items qty, preserve it as fallback
      if (hasQuantityColumn && src.quantity && mergedQuantity === 0) mergedQuantity += Number(src.quantity) || 0;
    }

    mergedLineItems.splice(0, mergedLineItems.length, ...uniqBy(mergedLineItems, item => [item.sku || '', item.description || '', item.quantity || 1].join('|')));
    const finalProducts = mergeProducts(Array.isArray(targetNorm.products) ? targetNorm.products : [], mergedProducts);
    const finalAttachments = uniqBy(mergedAttachments, item => String(item));

    const updatedNorm = {
      ...targetNorm,
      products: finalProducts,
      merged_from: uniqBy([...SOURCE_IDS, ...(Array.isArray(targetNorm.merged_from) ? targetNorm.merged_from : [])], x => x),
    };

    console.log('Merged summary:');
    console.log({
      target_id: TARGET_ID,
      merged_from: SOURCE_IDS,
      line_items_count: mergedLineItems.length,
      products_count: finalProducts.length,
      attachment_count: finalAttachments.length,
      quantity: hasQuantityColumn ? mergedQuantity : '(column absent, preserved in line_items/products)',
    });

    backupDb();
    await dbRun(db, 'BEGIN TRANSACTION');
    const updateSql = hasQuantityColumn
      ? `UPDATE orders SET line_items = ?, normalized_data = ?, attachment_paths = ?, quantity = ?, order_number = ?, invoice_number = ?, bt_from = ?, bt_to = ? WHERE id = ?`
      : `UPDATE orders SET line_items = ?, normalized_data = ?, attachment_paths = ?, order_number = ?, invoice_number = ?, bt_from = ?, bt_to = ? WHERE id = ?`;
    const updateParams = hasQuantityColumn
      ? [
          JSON.stringify(mergedLineItems),
          JSON.stringify(updatedNorm),
          JSON.stringify(finalAttachments),
          mergedQuantity,
          target.order_number || TARGET_ID,
          target.invoice_number || null,
          target.bt_from || updatedNorm.comingFrom || null,
          target.bt_to || updatedNorm.destination || null,
          TARGET_ID,
        ]
      : [
          JSON.stringify(mergedLineItems),
          JSON.stringify(updatedNorm),
          JSON.stringify(finalAttachments),
          target.order_number || TARGET_ID,
          target.invoice_number || null,
          target.bt_from || updatedNorm.comingFrom || null,
          target.bt_to || updatedNorm.destination || null,
          TARGET_ID,
        ];
    await dbRun(db, updateSql, updateParams);

    // move attachment ownership to the target order
    await dbRun(db, `UPDATE email_attachments SET order_id = ? WHERE order_id IN (${SOURCE_IDS.map(() => '?').join(',')})`, [TARGET_ID, ...SOURCE_IDS]);

    // delete duplicate order rows after merge
    await dbRun(db, `DELETE FROM orders WHERE id IN (${SOURCE_IDS.map(() => '?').join(',')})`, SOURCE_IDS);
    await dbRun(db, 'COMMIT');

    console.log('Merge applied successfully.');
  } catch (err) {
    try { await dbRun(db, 'ROLLBACK'); } catch {}
    console.error('Merge failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
