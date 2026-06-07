const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dav_transport.db');
const db = new sqlite3.Database(dbPath);

const subjects = [
  "Fwd: BT from Harvey Norman Wairau Park to Hastings",
  "Fwd: Urgent BT from Lowerhutt",
  "Fwd: BT FROM NEW PLYMOUTH AND PORIRUA"
];

db.serialize(() => {
  subjects.forEach(subject => {
    db.all(`SELECT id FROM orders WHERE email_subject LIKE ?`, [`%${subject}%`], (err, rows) => {
      if (rows) {
        rows.forEach(r => {
          db.all(`SELECT file_path FROM email_attachments WHERE order_id = ?`, [r.id], (err, atts) => {
            console.log(`Subject: ${subject} -> Paths: ${atts.map(a => a.file_path).join(', ')}`);
          });
        });
      }
    });
  });
});
