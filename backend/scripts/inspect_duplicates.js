const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'dav_transport.db'));

const ids = ['BT_59c158c6','BT_60fa36d8','BT_a2c57f26','BT_c6407efd','BT_5516a620'];

db.serialize(() => {
  const stmt = db.prepare(`SELECT id, order_number, invoice_number, bt_from, bt_to, email_subject, email_from, email_date, line_items, normalized_data, attachment_paths, createdAt FROM orders WHERE id = ?`);
  (async () => {
    for (const id of ids) {
      await new Promise((res) => {
        stmt.get(id, (err, row) => {
          console.log('\n---');
          if (err) { console.error('ERR', id, err); return res(); }
          if (!row) { console.log('Missing order row for', id); return res(); }
          console.log('id:', row.id);
          console.log('order_number:', row.order_number, 'invoice:', row.invoice_number);
          console.log('bt_from -> bt_to:', row.bt_from, '->', row.bt_to);
          console.log('email_from:', row.email_from);
          console.log('email_subject:', row.email_subject);
          console.log('createdAt:', row.createdAt);
          console.log('line_items:', (row.line_items || '').slice(0,200));
          console.log('normalized_data:', (row.normalized_data || '').slice(0,200));
          console.log('attachment_paths:', (row.attachment_paths || '').slice(0,200));
          res();
        });
      });
    }
    stmt.finalize();
    db.close();
  })();
});
