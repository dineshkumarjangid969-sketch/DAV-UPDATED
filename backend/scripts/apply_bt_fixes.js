const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.resolve(__dirname, '..', 'dav_transport.db');
const BACKUP_PATH = DB_PATH + '.bak.' + Date.now();

function backupDb() {
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('DB backup created at', BACKUP_PATH);
}

function applyFixes(fixes) {
  if (!Array.isArray(fixes) || fixes.length === 0) {
    console.log('No fixes to apply');
    return;
  }

  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare("UPDATE orders SET normalized_data = json_patch(normalized_data, ?) WHERE id = ?");
    for (const f of fixes) {
      console.log('Applying fix to order', f.id, 'changes:', JSON.stringify(f.changes));
      stmt.run(JSON.stringify(f.changes), f.id);
    }
    stmt.finalize();
    db.run('COMMIT');
  });
  db.close();
  console.log('Applied', fixes.length, 'fixes');
}

function loadDryRun(file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) throw new Error('Dry-run file not found: ' + p);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node apply_bt_fixes.js <dry-run.json>');
    process.exit(1);
  }
  const dry = loadDryRun(arg);
  const high = dry.proposals
    .filter(p => p.score >= 4 && p.patch && Object.keys(p.patch).length > 0)
    .map(p => ({ id: p.order_id, changes: p.patch }));
  if (high.length === 0) {
    console.log('No high-confidence fixes (score >=4) found. Exiting.');
    return;
  }
  console.log('High-confidence fixes to apply:', high.length);
  backupDb();
  applyFixes(high);
}

main();
