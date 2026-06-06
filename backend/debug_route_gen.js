const { normalizeOrderExtraction, STORE_REGISTRY } = require('./server.js');
const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');

const regexFunc = /function extractRouteFromContent[\s\S]*?\n\}/;
let extractCode = code.match(regexFunc)[0];

// Insert console.logs
extractCode = extractCode.replace(/let requesterStore = null;/, 'let requesterStore = null; console.log("Before Requester:", comingFrom, destination);');
extractCode = extractCode.replace(/if \(\!requesterStore\) \{/, 'if (!requesterStore) { console.log("Checking fromAddress:", fromAddress);');
extractCode = extractCode.replace(/let otherStore = null;/, 'console.log("requesterStore:", requesterStore); let otherStore = null;');
extractCode = extractCode.replace(/if \(requesterStore && otherStore\) \{/, 'console.log("otherStore:", otherStore); if (requesterStore && otherStore) {');
extractCode = extractCode.replace(/const orderStore = extractStoreFromOrderNumber\(combinedText\);/, 'console.log("Before Rule 6:", comingFrom, destination); const orderStore = extractStoreFromOrderNumber(combinedText);');
extractCode = extractCode.replace(/const allFound = findAllStoresInText\(combinedText\);/, 'console.log("Before Rule 7:", comingFrom, destination); const allFound = findAllStoresInText(combinedText);');
extractCode = extractCode.replace(/return \{/, 'console.log("Returning:", comingFrom, destination); return {');

const testCode = `
const { matchStore, extractStoreFromOrderNumber, findAllStoresInText } = require('./server.js');
${extractCode}

const cache = require('./docling_cache.json');
const keys = Object.keys(cache).filter(k => cache[k].raw_markdown && cache[k].raw_markdown.includes('NZ0200000342578'));
const doclings = keys.map(k => cache[k]);

const subject = 'Fwd: Fw: PO# NZ0200000342578 - Order Status = Accepted (Pending)';
const from = 'Bedding, Manukau <Manukau.Bedding@nz.harveynorman.com>';
const body = 'Please collect this BT from Pukekohe store and deliver to Harvey Norman Wairau park warehouse.';
const html = '';

const attachmentsText = doclings.map(d => d.raw_markdown).join('\\n');
extractRouteFromContent(subject, from, body, attachmentsText);
`;

fs.writeFileSync('debug_route_explicit.js', testCode);
