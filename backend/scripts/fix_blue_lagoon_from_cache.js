const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const cache = JSON.parse(fs.readFileSync('docling_cache.json', 'utf8'));
const db = new sqlite3.Database('dav_transport.db');

const keys = Object.keys(cache);
const targetNames = ['34f45cb1-2299-4efa-838e-e1130dd5f87a.pdf','0c681a55-7e0f-486a-a083-ed0c36e91595.pdf'];

function basename(p) { return path.basename(p); }

db.serialize(() => {
  const q = `SELECT id, order_number, invoice_number, attachment_paths FROM orders WHERE attachment_paths LIKE '%34f45cb1%' OR attachment_paths LIKE '%0c681a55%'`;
  db.all(q, (err, rows) => {
    if (err) { console.error(err); process.exit(1); }
    if (!rows.length) { console.log('No matching orders found.'); db.close(); return; }
    console.log('Found orders:', rows.length);
    rows.forEach(r => {
      console.log('Order row:', r.id, r.order_number, r.invoice_number);
      let paths = [];
      try { paths = JSON.parse(r.attachment_paths); } catch(e) { try { paths = r.attachment_paths.split(' '); } catch(e2) { paths = []; } }
      // Determine values from cache
      let newInvoice = r.invoice_number;
      let newOrder = r.order_number;
      for (const p of paths) {
        const name = basename(p);
        if (cache[name]) {
          const entry = cache[name];
          // Prefer docling cache values when available
          if (entry.invoice_number) newInvoice = entry.invoice_number;
          // prefer explicit order_number from docling, else use po_number
          if (entry.order_number) newOrder = entry.order_number;
          else if (entry.po_number) newOrder = entry.po_number;
        }
      }
      console.log(' -> updating to order:', newOrder, 'invoice:', newInvoice);
      db.run('UPDATE orders SET order_number = ?, invoice_number = ? WHERE id = ?', [newOrder, newInvoice, r.id], function(err2) {
        if (err2) console.error('Update error', err2.message);
        else console.log('Updated row', r.id);
      });
    });
    db.close();
  });
});
