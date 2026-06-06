const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

// Strip out app.listen and module.exports
const safeCode = code
  .replace(/app\.listen\([\s\S]*?\);/g, '')
  .replace(/module\.exports = [\s\S]*?;/g, '')
  .replace(/startScheduler\(\);/g, '');

eval(safeCode);

const subject = 'Fwd: BT Invoice#3831158';
const from = 'Singh, Ninder <Ninder.Singh@nz.harveynorman.com>';
const body = 'Could you please organise attached from Mt Wellington.\n\nThanks\n\n\nBest Regards,\nNinder Singh\nPorirua | Furniture Proprietor';

const md1 = `Harvey Norman Stores (NZ) Pty Ltd Harvey Norman Bedding Mt Wellington 20-54 Mt Wellington Highway Mt Wellington N.Z. Ph: 09 570 3440\n\nReprinted:\n\n30/05/26 16:53:05\n\nAssistant:\n\n5823/44 CICI\n\nDate:\n\n30/05/26\n\nOperator:\n\n5823/44 Cici\n\nTime:\n\n16:26:54\n\nCustomer:\n\n092614399\n\nLocation:\n\n22\n\nSales Type:\n\n*** DO NOT USE ***\n\nTransaction: 10095256\n\nOrder:\n\nNZ0200000342562\n\n## TAX INVOICEINVOICE REPRINT 22/3831432\n\nHN Bedding Manukau HARVEYNORMAN MANUKAU 8/72 CAVENDISH DR MANUKAU 2104\n\n*** G.S.T. EXEMPT ***\n\n*** F2F STOCK SALES ***\n\n## F2F Sale Details\n\nPO Number:\n\n342562\n\nRequested By:\n\nAlex Jones\n\nCustomer Name:\n\nHN Bedding Manukau\n\n## HARRINGTON SOFT QUN MAT\n\nQuantity:\n\n1\n\nPrice:\n\n$1,172.50\n\nDept.Code:\n\n057\n\nProduct Code:\n\n* 0001206915\n\n## Warranty Information\n\nManufacturer Warranty of 120 Months\n\nSee Manufacturers documentation for Warranty Details.\n\n## Other Details\n\nDelivery to be Advised STOCK from Store/Store Store To Door Delivery Service\n\nItem Total: $1,172.50\n\n## Invoice Notes\n\nPayment type: HN Account\n\n## Delivery Address\n\nHN Bedding Manukau\n\nSUPA CENTRE 72 CAVENDISH DR MANUKAU 2241\n\nPhone: 092614300\n\nSMS Delivery Updates To 092614300\n\nINV TOTAL BALANCE OWING GST No.\n\n$1,172.50\n\n$1,172.50\n\n68.036.003\n\nGST No. 68.036.003\n\nCustomer Signature:\n\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\nNo of Pieces:\n\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\nSign up for our email newsletter to enter the draw to WIN a $500 Harvey Norman Gift Card. There's a new WINNER every month! Visit www.harveynorman.co.nz/signup for details. Terms and conditions apply.`;

const doc1 = { raw_markdown: md1, raw_tables: [], line_items: [], invoice_number: '22/3831432', order_number: 'NZ0200000342562', filename: 'Invoice_3831432.pdf' };

console.log('Testing DOC 1 independently:');
const norm1 = normalizeOrderExtraction(subject, from, body, '', [doc1]);
console.log(norm1);

const md2 = `P/O Response 248165           Version: 1\n\nPOR Status: Accepted\n\nResponse From: 5633 DJ\n\nHN FURNITURE MT WELLINGTON\n\nSupplier Invoice: 3831158\n\nGIANNI PU DIN CHAIR             Accepted\n\n6001\n\nORD: 6 @ 160.00              TOT: 960.00\n\nRES: 6 @ 160.00              TOT: 960.00\n\n<!-- image -->\n\nDelv Qty: 6         Est.Ship:\n\nRYDER RND EXT DIN TABLE - OAK   Accepted VOD-RYDE-03\n\nORD: 1 @ 690.00              TOT: 690.00\n\nRES: 1 @ 690.00              TOT: 690.00\n\n<!-- image -->\n\nBack Ord: 1         Est.Ship:\n\nAUBURN A/L CHR FAB L/G          Accepted\n\nS7517ALCHRFLG\n\nORD: 1 @ 350.00              TOT: 350.00\n\nRES: 1 @ 350.00              TOT: 350.00\n\n<!-- image -->\n\nDelv Qty: 1         Est.Ship:\n\nOrder  Response\n\nTotal Ex.GST           2000.00   2000.00\n\nTotal Incl.GST         2300.00   2300.00\n\n<!-- image -->\n\n* * *  End of Report  * * *`;

const doc2 = { raw_markdown: md2, raw_tables: [], line_items: [], invoice_number: '3831158', order_number: '248165', filename: 'BT_Mt_Wellington.pdf' };

console.log('\\nTesting DOC 2 independently:');
const norm2 = normalizeOrderExtraction(subject, from, body, '', [doc2]);
console.log(norm2);
