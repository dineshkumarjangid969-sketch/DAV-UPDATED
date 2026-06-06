const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'dav_transport.db');

const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.all(`SELECT id, order_number, invoice_number, bt_from, bt_to, email_subject, normalized_data FROM orders WHERE order_number LIKE '%055464%' OR invoice_number LIKE '%055464%' OR normalized_data LIKE '%055464%'`, [], (err, rows) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('Matches:', rows.length);
    for (const r of rows) {
      console.log('\n---');
      console.log('id:', r.id);
      console.log('order_number:', r.order_number);
      console.log('invoice_number:', r.invoice_number);
      console.log('bt_from:', r.bt_from, 'bt_to:', r.bt_to);
      console.log('subject:', r.email_subject);
      console.log('normalized_data:', r.normalized_data && String(r.normalized_data).slice(0,200));
    }
    db.close();
  });
});
