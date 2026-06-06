const text = `trading as Harvey Norman Furniture Christchurch
Harvey Norman Stores (NZ) Pty Ltd GST No. 68.036.003
Mt Wellington 1060 20-54 Mt Wellington Hwy HN Furniture Mt Wellington Date: 02/06/26  Time: 08:54:55 Assistant: Tiana Hogg Customer: 000000700155 Sale Type: STFR

## SHIPPING ADDRESS

HN Furniture Mt Wellington 20-54 MT WELLINGTON HWY MT WELLINGTON 1060`;

const sourceMatch = text.match(/trading as Harvey Norman(?: Furniture)? ([a-zA-Z ]+)/i);
console.log('Source:', sourceMatch ? sourceMatch[1].trim() : 'null');

const addrMatch = text.match(/## SHIPPING ADDRESS[\s\n]+([^\n]+)/i);
console.log('Address:', addrMatch ? addrMatch[1].trim() : 'null');

const destMatch = text.match(/\n([A-Za-z ]+)\s+\d{4}\s+/);
console.log('Destination:', destMatch ? destMatch[1].trim() : 'null');
