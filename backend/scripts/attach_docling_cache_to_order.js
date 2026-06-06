const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const DB = 'dav_transport.db';
const UPLOADS = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docling_cache.json'), 'utf8'));

const db = new sqlite3.Database(DB);

db.serialize(() => {
  const q = `SELECT id, attachment_paths FROM orders WHERE email_subject LIKE '%Blue Lagoon%'`;
  db.all(q, (err, rows) => {
    if (err) { console.error('DB error', err.message); process.exit(1); }
    if (!rows || rows.length === 0) {
      console.log('No Blue Lagoon orders found.');
      db.close();
      return;
    }
    rows.forEach(r => {
      console.log('Processing order', r.id);
      let paths = [];
      try { paths = JSON.parse(r.attachment_paths); } catch (e) { try { paths = r.attachment_paths.split(' '); } catch(e2){ paths = []; } }
      paths.forEach(origPath => {
        const name = path.basename(origPath);
        if (!cache[name]) return;
        const entry = cache[name];
        const content = entry.raw_markdown || entry.raw_text || JSON.stringify(entry, null, 2);
        const attId = uuidv4();
        const filename = `${attId}.txt`;
        const filePath = path.join(UPLOADS, filename);
        fs.writeFileSync(filePath, content, 'utf8');

        const now = new Date().toISOString();
        const insert = `INSERT INTO email_attachments (id, order_id, filename, file_path, content_type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(insert, [attId, r.id, name + '.cache.txt', filePath, 'text/plain', now, now], function(err2) {
          if (err2) console.error('Insert attachment error', err2.message);
          else console.log('Created synthetic attachment for', r.id, filePath);
        });
      });
    });
    // allow writes to finish
    setTimeout(() => db.close(), 500);
  });
});
