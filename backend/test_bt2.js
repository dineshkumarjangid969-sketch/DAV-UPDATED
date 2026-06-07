const text = `TAPE CONTENTS
24/05/2026 16:54:30                       7266
P/O Response 283111                       Version: 1
POR Status: Accepted

Response From: 8000 Arun Beniwal
HN FURNITURE LOWER HUTT
Supplier Invoice: 2701019

STANZA DIN CHR GREY FABRIC                Accepted
1199DC
ORD: 6 @ 150.00                           TOT: 900.00
RES: 6 @ 150.00                           TOT: 900.00
Delv Qty: 6               Est.Ship:`;

const inv = text.match(/Supplier Invoice:\s*([0-9]+)/i);
console.log('INV:', inv ? inv[1] : null);

const order = text.match(/P\/O Response\s*([0-9]+)/i);
console.log('ORD:', order ? order[1] : null);

const store = text.match(/Response From:[^\n]*\n(?:HN FURNITURE\s*)?([A-Za-z ]+)/i);
console.log('STORE:', store ? store[1].trim() : null);

const productMatch = text.match(/\n\n([A-Z0-9\s]+?)\s+Accepted\s*\n\s*([A-Z0-9\-_]+)\s*\n[\s\S]*?Delv Qty:\s*(\d+)/i);
if (productMatch) {
    console.log('PRODUCT DESC:', productMatch[1].trim());
    console.log('PRODUCT SKU:', productMatch[2].trim());
    console.log('PRODUCT QTY:', productMatch[3].trim());
}
