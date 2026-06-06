const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const pdfParse = require('pdf-parse');
const db = new sqlite3.Database('dav_transport.db');

db.serialize(() => {
  const q = `SELECT id,order_number,invoice_number,email_subject,attachment_paths FROM orders
    WHERE email_subject LIKE '%Blue Lagoon%' OR invoice_number = '228468' OR order_number = '228468'`;
  db.all(q, (err, rows) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('ROWS:', JSON.stringify(rows, null, 2));
    rows.forEach(r => {
      if (r.attachment_paths) {
        let paths = [];
        try {
          paths = JSON.parse(r.attachment_paths);
        } catch (e) {
          paths = r.attachment_paths.split(' ');
        }
        console.log('ATTACHMENTS:', paths);
        paths.forEach(p => {
          try {
            const buf = fs.readFileSync(p);
            pdfParse(buf).then(d => {
              console.log('--- TEXT START', p, '---');
              console.log(d.text.substring(0, 2000).replace(/\n/g, '\\n'));
              console.log('--- TEXT END ---');
            }).catch(err => console.error('pdfParse err', err.message));
          } catch (err) {
            console.error('read err', err.message);
          }
        });
      }
    });
    db.close();
  });
});
