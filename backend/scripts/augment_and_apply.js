const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const file = path.join(__dirname, 'generate_dry_run_for_apply.json');
if (!fs.existsSync(file)) {
  console.error('Dry-run file not found:', file);
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);
const proposals = obj.proposals || [];
let changed = 0;
for (const p of proposals) {
  if ((p.score || 0) < 4) continue;
  if (!p.patch || Object.keys(p.patch).length === 0) {
    const patch = {};
    const cur = p.current || {};
    const prop = p.proposed || {};
    if (prop.order_number && prop.order_number !== 'Not identified' && prop.order_number !== cur.order_number) patch.orderNo = prop.order_number;
    if (prop.invoice_number && prop.invoice_number !== 'Not identified' && prop.invoice_number !== cur.invoice_number) patch.invoiceNo = prop.invoice_number;
    if (prop.bt_from && prop.bt_from !== 'Not identified' && prop.bt_from !== cur.bt_from) patch.comingFrom = prop.bt_from;
    if (prop.bt_to && prop.bt_to !== 'Not identified' && prop.bt_to !== cur.bt_to) patch.destination = prop.bt_to;
    if (Object.keys(patch).length > 0) {
      p.patch = patch;
      changed++;
    }
  }
}

if (changed === 0) {
  console.log('No patches generated for score>=4 proposals. Exiting.');
  process.exit(0);
}

// backup
fs.copyFileSync(file, file + '.bak.' + Date.now());
fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
console.log('Generated', changed, 'patches and updated', file);

// run apply script
const apply = spawnSync(process.execPath, [path.join(__dirname, 'apply_bt_fixes.js'), file], { stdio: 'inherit' });
if (apply.error) {
  console.error('Failed to run apply script:', apply.error);
  process.exit(1);
}
process.exit(apply.status || 0);
