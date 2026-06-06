const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'dav_transport.db');
const cachePath = path.join(__dirname, '..', 'docling_cache.json');
const uploadsDir = path.join(__dirname, '..', 'uploads');

const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

const STORE_REGISTRY = {
  'Wairau Park': { aliases: ['Wairau', 'wairau park', 'commercial wairau'] },
  'Albany': { aliases: ['albany'] },
  'Westgate': { aliases: ['westgate'] },
  'Lower Hutt': { aliases: ['lower hutt', 'hutt', 'lowerhutt'] },
  'Palmerston North': { aliases: ['palmerston north', 'palmy'] },
  'Hamilton': { aliases: ['hamilton'] },
  'Whanganui': { aliases: ['whanganui', 'wanganui'] },
  'Whakatane': { aliases: ['whakatane'] },
  'Whangarei': { aliases: ['whangarei'] },
  'Hastings': { aliases: ['hastings', 'akina'] },
  'Mt Wellington': { aliases: ['mt wellington', 'mount wellington'] },
  'Manukau': { aliases: ['manukau'] },
  'Porirua': { aliases: ['porirua'] },
  'New Plymouth': { aliases: ['new plymouth'] },
  'Pukekohe': { aliases: ['pukekohe'] },
  'Mt Maunganui': { aliases: ['mt maunganui', 'mount maunganui'] },
  'Botany': { aliases: ['botany'] },
  'Rotorua': { aliases: ['rotorua'] },
  'Masterton': { aliases: ['masterton'] },
  'Mt Roskill': { aliases: ['mt roskill', 'mount roskill'] },
  'Dargaville': { aliases: ['dargaville'] },
  'Timaru': { aliases: ['timaru'] },
};

const storeMap = {};
for (const [store, data] of Object.entries(STORE_REGISTRY)) {
  storeMap[store.toLowerCase()] = store;
  for (const alias of data.aliases || []) storeMap[alias.toLowerCase()] = store;
}

function compact(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

function normalizeStore(name) {
  if (!name) return null;
  const clean = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  const compacted = compact(clean);
  for (const [store, data] of Object.entries(STORE_REGISTRY)) {
    if (store.toLowerCase() === clean || compact(store) === compacted) return store;
    for (const alias of data.aliases || []) {
      if (alias.toLowerCase() === clean || compact(alias) === compacted) return store;
    }
  }
  for (const store of Object.keys(STORE_REGISTRY)) {
    const s = store.toLowerCase();
    if (s.includes(clean) || clean.includes(s) || compact(s).includes(compacted) || compacted.includes(compact(s))) return store;
  }
  return name;
}

function matchStore(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  const compacted = compact(text);
  for (const [store, data] of Object.entries(STORE_REGISTRY)) {
    const candidates = [store, ...(data.aliases || [])];
    for (const candidate of candidates) {
      const lc = candidate.toLowerCase();
      if (lower.includes(lc) || compacted.includes(compact(lc)) || compact(lc).includes(compacted)) {
        return store;
      }
    }
  }
  return null;
}

function parseJsonMaybe(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function getAttachmentText(filePath) {
  const name = path.basename(filePath || '');
  const cacheEntry = cache[name];
  if (cacheEntry) {
    return [cacheEntry.raw_markdown, cacheEntry.raw_text].find(Boolean) || '';
  }
  if (!filePath) return '';
  const exists = fs.existsSync(filePath);
  if (!exists) return '';
  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('utf8');
    return text.length > 20 ? text : '';
  } catch {
    return '';
  }
}

function extractCandidates(text) {
  const candidates = { invoice: [], order: [], po: [], stores: [] };
  const patterns = {
    invoice: [
      /(?:invoice|supplier invoice|inv)[:\s#-]*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/ig,
    ],
    order: [
      /(?:order|sales order|so)[:\s#-]*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/ig,
      /(?:purchase order|po number|po)[:\s#-]*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/ig,
    ],
    po: [
      /(?:purchase order|po number|po)[:\s#-]*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/ig,
    ],
  };
  for (const [kind, regs] of Object.entries(patterns)) {
    for (const reg of regs) {
      let match;
      while ((match = reg.exec(text || '')) !== null) {
        candidates[kind].push(match[1].trim());
      }
    }
  }
  const stores = [];
  for (const store of Object.keys(STORE_REGISTRY)) {
    if ((text || '').toLowerCase().includes(store.toLowerCase()) || compact(text || '').includes(compact(store))) {
      stores.push(store);
    }
  }
  candidates.stores = [...new Set(stores)];
  candidates.invoice = [...new Set(candidates.invoice)];
  candidates.order = [...new Set(candidates.order)];
  candidates.po = [...new Set(candidates.po)];
  return candidates;
}

function inferRoute(subject, body, attachmentsText) {
  const text = `${subject || ''}\n${body || ''}\n${attachmentsText || ''}`;
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const route = { comingFrom: null, destination: null };

  const fromToPatterns = [
    /(?:bt\s*\d*|branch\s*transfer|goods\s*movement|urgent\s*bt)?\s*(?:from\s+)?([a-z0-9\s./-]+?)\s*(?:to|->|→|\/|2|-)\s*([a-z0-9\s./-]+?)(?:\b|$)/i,
    /from[:\s]+([a-z0-9\s./-]+?)\s+to[:\s]+([a-z0-9\s./-]+?)(?:\b|$)/i,
  ];

  for (const reg of fromToPatterns) {
    const m = lower.match(reg);
    if (m) {
      route.comingFrom = normalizeStore(m[1]);
      route.destination = normalizeStore(m[2]);
      break;
    }
  }

  if (!route.comingFrom || !route.destination) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/(?:from|pickup|collect|collection)[:\s]+(.+?)(?:\s+(?:to|deliver to|delivery to)\s+(.+))?$/i);
      if (m) {
        route.comingFrom = route.comingFrom || normalizeStore(m[1]);
        if (m[2]) route.destination = route.destination || normalizeStore(m[2]);
      }
      const n = line.match(/(?:to|deliver to|destination)[:\s]+(.+)$/i);
      if (n) route.destination = route.destination || normalizeStore(n[1]);
    }
  }

  if (!route.comingFrom || !route.destination) {
    const found = Object.keys(STORE_REGISTRY).filter(s => lower.includes(s.toLowerCase()) || compact(lower).includes(compact(s)));
    if (found.length === 1) {
      route.destination = route.destination || found[0];
    } else if (found.length >= 2) {
      route.comingFrom = route.comingFrom || found[0];
      route.destination = route.destination || found.find(s => s !== route.comingFrom) || found[1];
    }
  }

  return route;
}

function scoreProposal(order, proposal) {
  let score = 0;
  if (proposal.order_number && proposal.order_number !== 'Not identified') score += 2;
  if (proposal.invoice_number && proposal.invoice_number !== 'Not identified') score += 2;
  if (proposal.comingFrom && proposal.comingFrom !== 'Not identified') score += 2;
  if (proposal.destination && proposal.destination !== 'Not identified') score += 2;
  if (proposal.products && proposal.products.length > 0) score += 1;
  if (String(order.email_subject || '').toLowerCase().includes('bt')) score += 1;
  return score;
}

async function main() {
  const sequelize = new sqlite3.Database(dbPath);
  const rows = await new Promise((resolve, reject) => {
    sequelize.all(
      `SELECT id, order_number, invoice_number, bt_from, bt_to, type, bt_type, email_subject, email_from, raw_email_body, normalized_data, attachment_paths, line_items, createdAt
       FROM orders
       WHERE lower(coalesce(type, '')) LIKE '%branch_transfer%'
          OR lower(coalesce(bt_type, '')) LIKE '%branch_transfer%'
          OR lower(coalesce(email_subject, '')) LIKE '%bt%'
          OR lower(coalesce(email_subject, '')) LIKE '%branch transfer%'
          OR lower(coalesce(email_subject, '')) LIKE '%goods movement%'
       ORDER BY createdAt DESC`,
      [],
      (err, result) => (err ? reject(err) : resolve(result || []))
    );
  });

  const proposals = [];
  for (const row of rows) {
    const normalized = parseJsonMaybe(row.normalized_data) || {};
    const isNotIdentified = [row.order_number, row.invoice_number, row.bt_from, row.bt_to, normalized.invoiceNo, normalized.comingFrom, normalized.destination].some(v => !v || v === 'Not identified');
    if (!isNotIdentified) continue;

    const attPaths = parseJsonMaybe(row.attachment_paths) || [];
    const texts = [];
    for (const attPath of attPaths) {
      const text = getAttachmentText(attPath);
      if (text) texts.push(text);
    }

    const attachmentsText = texts.join('\n\n');
    const bodyText = row.raw_email_body || normalized.sourceEmailBody || '';
    const route = inferRoute(row.email_subject || '', bodyText, attachmentsText);
    const combinedText = `${row.email_subject || ''}\n${bodyText}\n${attachmentsText}`;
    const candidates = extractCandidates(combinedText);

    const proposal = {
      id: row.id,
      email_subject: row.email_subject,
      current: {
        order_number: row.order_number,
        invoice_number: row.invoice_number,
        bt_from: row.bt_from,
        bt_to: row.bt_to,
      },
      proposed: {
        order_number: row.order_number && row.order_number !== 'Not identified' ? row.order_number : (candidates.order[0] || normalized.orderNo || normalized.po_number || normalized.poNumber || 'Not identified'),
        invoice_number: row.invoice_number && row.invoice_number !== 'Not identified' ? row.invoice_number : (candidates.invoice[0] || normalized.invoiceNo || 'Not identified'),
        bt_from: row.bt_from && row.bt_from !== 'Not identified' ? row.bt_from : (normalized.comingFrom && normalized.comingFrom !== 'Not identified' ? normalized.comingFrom : route.comingFrom || 'Not identified'),
        bt_to: row.bt_to && row.bt_to !== 'Not identified' ? row.bt_to : (normalized.destination && normalized.destination !== 'Not identified' ? normalized.destination : route.destination || 'Not identified'),
      },
      evidence: {
        route,
        candidates,
        attachment_count: attPaths.length,
        cache_hits: attPaths.map(p => path.basename(p)).filter(name => cache[name]).length,
      },
    };

    proposal.score = scoreProposal(row, proposal.proposed);
    proposals.push(proposal);
  }

  console.log(`BT dry-run proposals: ${proposals.length}`);
  for (const p of proposals) {
    console.log('\n===', p.id, '===');
    console.log('Subject:', p.email_subject);
    console.log('Current:', JSON.stringify(p.current));
    console.log('Proposed:', JSON.stringify(p.proposed));
    console.log('Evidence:', JSON.stringify(p.evidence));
    console.log('Score:', p.score);
  }

  sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
