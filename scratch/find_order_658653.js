const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../backend/dav_transport.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("--- Checking orders table ---");
  db.all("SELECT * FROM orders WHERE order_number LIKE '%658653%' OR order_number LIKE '%2658358%' OR bt_number LIKE '%2658358%'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Orders:", JSON.stringify(rows, null, 2));
  });

  console.log("--- Checking emails table ---");
  db.all("SELECT * FROM emails WHERE subject LIKE '%658653%' OR subject LIKE '%2658358%'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Emails:", JSON.stringify(rows, null, 2));
  });
  
  console.log("--- Checking attachments table ---");
  db.all("SELECT * FROM attachments WHERE filename LIKE '%658653%' OR filename LIKE '%2658358%' OR email_id IN (SELECT id FROM emails WHERE subject LIKE '%658653%' OR subject LIKE '%2658358%')", [], (err, rows) => {
    if (err) console.error(err);
    else {
        rows.forEach(r => {
            console.log(`Attachment: ${r.filename}, email_id: ${r.email_id}, parsed_data:`, r.parsed_data);
        });
    }
  });
});
