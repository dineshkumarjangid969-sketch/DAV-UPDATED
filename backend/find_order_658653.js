const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dav_transport.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("--- Checking orders table ---");
  db.all("SELECT id, order_number, invoice_number, status, document_type FROM orders WHERE order_number LIKE '%658653%' OR order_number LIKE '%2658358%' OR invoice_number LIKE '%658653%' OR raw_email_body LIKE '%658653%'", [], (err, rows) => {
    if (err) console.error(err);
    else {
      console.log("Orders:", JSON.stringify(rows, null, 2));
      
      if (rows && rows.length > 0) {
        const orderIds = rows.map(r => `'${r.id}'`).join(',');
        db.all(`SELECT id, order_id, filename, file_path FROM email_attachments WHERE order_id IN (${orderIds})`, [], (err, aRows) => {
          if (err) console.error(err);
          else console.log("Attachments for these orders:", JSON.stringify(aRows, null, 2));
        });
      }
    }
  });

});
