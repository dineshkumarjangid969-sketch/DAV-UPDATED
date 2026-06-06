const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');
eval(code.replace(/app\.listen[\s\S]*/, ''));

const cache = require('./docling_cache.json');
const keys = Object.keys(cache).filter(k => cache[k].raw_markdown && cache[k].raw_markdown.includes('NZ0200000342578'));
const doclings = keys.map(k => cache[k]);

const subject = 'Fwd: Fw: PO# NZ0200000342578 - Order Status = Accepted (Pending)';
const from = 'Bedding, Manukau <Manukau.Bedding@nz.harveynorman.com>';
const body = 'Please collect this BT from Pukekohe store and deliver to Harvey Norman Wairau park warehouse.';

const combinedText = `
  Subject: ${subject}
  From: ${from}
  ${body}
  ${doclings.map(d => d.raw_markdown).join('\n')}
`;

console.log(extractRouteFromContent(combinedText));
