const fs = require('fs');
const path = require('path');
const _pdfModule = require('pdf-parse');
const pdfParse = async (buf) => {
  const input = (buf && buf.constructor && buf.constructor.name === 'Buffer') ? new Uint8Array(buf) : buf;
  if (typeof _pdfModule === 'function') return _pdfModule(input);
  if (_pdfModule && typeof _pdfModule.default === 'function') return _pdfModule.default(input);
  if (_pdfModule && typeof _pdfModule.parseBuffer === 'function') return _pdfModule.parseBuffer(input);
  // support object shape exposing PDFParse constructor (pdf-parse v2 exports)
  if (_pdfModule && typeof _pdfModule.PDFParse === 'function') {
    const inst = new _pdfModule.PDFParse(input);
    if (typeof inst.getText === 'function') {
      const txt = await inst.getText();
      if (typeof txt === 'string') return { text: txt };
      if (txt && typeof txt.text === 'string') return txt;
      return { text: String(txt) };
    }
  }
  throw new Error('pdf-parse: no callable export found');
};
const sqlite3 = require('sqlite3').verbose();

const uploadsDir = path.join(__dirname, '..', 'uploads');
const db = new sqlite3.Database('dav_transport.db');

function extractNumbersFromText(text) {
  const results = new Set();
  if (!text) return [];
  const patterns = [
    /Inv(?:oice|ice Reprint|oice Reprint)?[:#\s]*([0-9\/\-]{4,20})/ig,
    /Invoice\s+Reprint\s*([0-9\/\-]{4,20})/ig,
    /Invoice[:#\s]*([0-9\/\-]{4,20})/ig,
    /Order[:#\s]*([0-9A-Za-z\/-]{2,30})/ig,
    /PO[#:\s]*([0-9A-Za-z\/-]{4,30})/ig,
    /Purchase Order[:#\s]*([0-9A-Za-z\/-]{2,30})/ig,
    /Sales Order[:#\s]*([0-9A-Za-z\/-]{2,30})/ig,
    /\b(\d{6,7})\b/g,
    /\b\d{1,2}\/\d{6,7}\b/g
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      if (m[1]) results.add(m[1].trim());
      else results.add(m[0].trim());
    }
  }
  return Array.from(results);
}

async function inspect() {
  const files = fs.readdirSync(uploadsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const summary = [];

  for (const f of files) {
    const p = path.join(uploadsDir, f);
    let text = '';
    try {
      const buf = fs.readFileSync(p);
      const data = await pdfParse(buf);
      text = data && data.text ? data.text : '';
    } catch (e) {
      console.error('Failed to read/parse', p, e.message);
      continue;
    }

    const nums = extractNumbersFromText(text);
    // find orders referencing this attachment
    const rows = await new Promise((res, rej) => db.all("SELECT id,order_number,invoice_number,attachment_paths,email_subject FROM orders", (err, rows) => err ? rej(err) : res(rows)));
    const matches = rows.filter(r => {
      try { const arr = JSON.parse(r.attachment_paths); return arr.some(a => a.endsWith(f)); } catch (e) { return (r.attachment_paths || '').indexOf(f) >= 0; }
    });
    if (matches.length === 0) {
      summary.push({ file: f, found_in_db: false, extracted_candidates: nums.slice(0,5), text_snippet: (text||'').substring(0,800).replace(/\n/g,'\\n') });
    } else {
      for (const m of matches) {
        const mismatches = [];
        const expectedInvoice = m.invoice_number || '';
        const expectedOrder = m.order_number || '';
        let invoiceFound = false;
        let orderFound = false;
        for (const c of nums) {
          if (expectedInvoice && c.includes(expectedInvoice)) invoiceFound = true;
          if (expectedOrder && c.includes(expectedOrder)) orderFound = true;
        }
        if (expectedInvoice && !invoiceFound) mismatches.push({ field: 'invoice_number', expected: expectedInvoice, found_candidates: nums.slice(0,5) });
        if (expectedOrder && !orderFound) mismatches.push({ field: 'order_number', expected: expectedOrder, found_candidates: nums.slice(0,5) });

        summary.push({ file: f, found_in_db: true, order_id: m.id, email_subject: m.email_subject, mismatches, extracted_candidates: nums.slice(0,5), text_snippet: (text||'').substring(0,800).replace(/\n/g,'\\n') });
      }
    }
  }

  console.log('PDF parse summary for uploads:');
  for (const s of summary) console.log(JSON.stringify(s, null, 2));
  db.close();
}

inspect().catch(e=>{ console.error(e); db.close(); process.exit(1); });
