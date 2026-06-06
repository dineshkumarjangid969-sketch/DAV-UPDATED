const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'dav_transport.db');
const cachePath = path.join(__dirname, '..', 'docling_cache.json');
const outPath = path.join(__dirname, 'generate_dry_run_for_apply.json');

const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

function compact(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
function normalizeStore(name) {
  if (!name) return null; return String(name).trim();
}
function parseJsonMaybe(value) { if (!value) return null; try { return JSON.parse(value); } catch { return null; } }

function getAttachmentText(filePath) {
  const name = path.basename(filePath || '');
  const cacheEntry = cache[name];
  if (cacheEntry) return (cacheEntry.raw_markdown || cacheEntry.raw_text || '') + '';
  if (!filePath) return '';
  if (!fs.existsSync(filePath)) return '';
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function extractCandidates(text) {
  const candidates = { invoice: [], order: [], stores: [] };
  const invoiceRe = /(?:invoice|inv)[:\s#-]*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/ig;
  const orderRe = /(?:order|so|sales order)[:\s#-]*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/ig;
  let m;
  while ((m = invoiceRe.exec(text || '')) !== null) candidates.invoice.push(m[1]);
  while ((m = orderRe.exec(text || '')) !== null) candidates.order.push(m[1]);
  return { invoice: [...new Set(candidates.invoice)], order: [...new Set(candidates.order)], stores: [] };
}

function inferRoute(subject, body, attachmentsText) {
  const text = `${subject || ''}\n${body || ''}\n${attachmentsText || ''}`.toLowerCase();
  const re = /from\s+([a-z0-9\s.-]+?)\s+(?:to|->)\s+([a-z0-9\s.-]+)/i;
  const m = text.match(re);
  if (m) return { comingFrom: normalizeStore(m[1]), destination: normalizeStore(m[2]) };
  return { comingFrom: null, destination: null };
}

function scoreProposal(order, proposal) {
  let score = 0;
  if (proposal.order_number && proposal.order_number !== 'Not identified') score += 2;
  if (proposal.invoice_number && proposal.invoice_number !== 'Not identified') score += 2;
  if (proposal.bt_from && proposal.bt_from !== 'Not identified') score += 2;
  if (proposal.bt_to && proposal.bt_to !== 'Not identified') score += 2;
  if (String(order.email_subject || '').toLowerCase().includes('bt')) score += 1;
  return score;
}

async function loadInternalSenders(db) {
  return new Promise((resolve) => {
    const senders = new Set();
    db.all("SELECT * FROM email_accounts", [], (err, rows) => {
      if (err || !rows) return resolve(senders);
      for (const r of rows) {
        for (const v of Object.values(r)) {
          try {
            if (typeof v === 'string' && v.includes('@')) senders.add(String(v).toLowerCase().trim());
          } catch (e) {
            // ignore
          }
        }
      }
      resolve(senders);
    });
  });
}

async function main() {
  const db = new sqlite3.Database(dbPath);
  const internalSenders = await loadInternalSenders(db);

  const rows = await new Promise((resolve, reject) => {
    db.all(`SELECT id, order_number, invoice_number, bt_from, bt_to, email_subject, email_from, raw_email_body, normalized_data, attachment_paths
            FROM orders
            WHERE lower(coalesce(type, '')) LIKE '%branch_transfer%'
               OR lower(coalesce(bt_type, '')) LIKE '%branch_transfer%'
               OR lower(coalesce(email_subject, '')) LIKE '%bt%'
               OR lower(coalesce(email_subject, '')) LIKE '%branch transfer%'
            ORDER BY createdAt DESC`, [], (err, rows) => err ? reject(err) : resolve(rows || []));
  });

  const proposals = [];
  for (const row of rows) {
    const normalized = parseJsonMaybe(row.normalized_data) || {};
    const from = String(row.email_from || '').toLowerCase().trim();
    // skip internal automated replies or common no-reply senders
    if (!from) {
      // continue
    } else {
      if (from.includes('no-reply') || from.includes('noreply') || from.includes('do-not-reply') || from.includes('donotreply')) continue;
      if (internalSenders.has(from)) continue;
    }
    const isNotIdentified = [row.order_number, row.invoice_number, row.bt_from, row.bt_to, normalized.invoiceNo, normalized.comingFrom, normalized.destination].some(v => !v || v === 'Not identified');
    if (!isNotIdentified) continue;

    const attPaths = parseJsonMaybe(row.attachment_paths) || [];
    const texts = attPaths.map(p => getAttachmentText(p)).filter(Boolean);
    const attachmentsText = texts.join('\n\n');
    const bodyText = row.raw_email_body || normalized.sourceEmailBody || '';
    const route = inferRoute(row.email_subject || '', bodyText, attachmentsText);
    const combinedText = `${row.email_subject || ''}\n${bodyText}\n${attachmentsText}`;
    const candidates = extractCandidates(combinedText);

    const proposed = {
      order_number: row.order_number && row.order_number !== 'Not identified' ? row.order_number : (candidates.order[0] || normalized.orderNo || 'Not identified'),
      invoice_number: row.invoice_number && row.invoice_number !== 'Not identified' ? row.invoice_number : (candidates.invoice[0] || normalized.invoiceNo || 'Not identified'),
      bt_from: row.bt_from && row.bt_from !== 'Not identified' ? row.bt_from : (normalized.comingFrom || route.comingFrom || 'Not identified'),
      bt_to: row.bt_to && row.bt_to !== 'Not identified' ? row.bt_to : (normalized.destination || route.destination || 'Not identified'),
    };

    const score = scoreProposal(row, proposed);

    const patch = {};
    if (proposed.order_number && proposed.order_number !== 'Not identified' && proposed.order_number !== row.order_number) patch.orderNo = proposed.order_number;
    if (proposed.invoice_number && proposed.invoice_number !== 'Not identified' && proposed.invoice_number !== row.invoice_number) patch.invoiceNo = proposed.invoice_number;
    if (proposed.bt_from && proposed.bt_from !== 'Not identified' && proposed.bt_from !== row.bt_from) patch.comingFrom = proposed.bt_from;
    if (proposed.bt_to && proposed.bt_to !== 'Not identified' && proposed.bt_to !== row.bt_to) patch.destination = proposed.bt_to;

    proposals.push({ order_id: row.id, score, proposed, patch });
  }

  fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(), proposals }, null, 2), 'utf8');
  console.log('Wrote', outPath, 'with', proposals.length, 'proposals');
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
