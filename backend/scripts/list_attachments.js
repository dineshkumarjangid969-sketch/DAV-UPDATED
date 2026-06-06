const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('dav_transport.db');
const orderId = process.argv[2] || '28/2860161';
db.all('SELECT id,order_id,filename,file_path,content_type,createdAt FROM email_attachments WHERE order_id = ?', [orderId], (err, rows) => {
  if (err) { console.error(err.message); process.exit(1); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
