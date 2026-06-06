const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

const cache = require('./docling_cache.json');
const keys = Object.keys(cache).filter(k => cache[k].raw_markdown && cache[k].raw_markdown.includes('NZ0200000342578'));
const doclings = keys.map(k => cache[k]);

const subject = 'Fwd: Fw: PO# NZ0200000342578 - Order Status = Accepted (Pending)';
const from = 'Bedding, Manukau <Manukau.Bedding@nz.harveynorman.com>';
const body = 'Please collect this BT from Pukekohe store and deliver to Harvey Norman Wairau park warehouse.';

// We'll extract the functions we need to run locally
let evalCode = code.replace(/app\.listen[\s\S]*/, '');
evalCode += `
  const emailBodyText = (body || "");
  let attachmentsText = "";
  for (const doc of doclings) {
    if (doc.raw_markdown) attachmentsText += doc.raw_markdown + "\\n";
  }
  
  // Now run the exact extractRouteFromContent logic with logs
  const combinedText = \`Subject: \${subject}\\nFrom: \${from}\\nBody: \${emailBodyText}\\nAttachments: \${attachmentsText}\`;
  const cleanCombinedText = combinedText.replace(/\\s+/g, " ").toLowerCase();
  console.log("requesterStore from matchStore(from):", matchStore(from));
  
  let comingFrom = null;
  let destination = null;
  
  const fromMatch = cleanCombinedText.match(/(?:from|pickup|pick up)[\\s\\:]+(?:the\\s+)?([A-Za-z\\s]+?)(?:\\s+store|\\s+branch|\\s+warehouse)?(?:\\.|\\n|<|$|\\s+to\\s+|\\s+and\\s+)/i);
  console.log("fromMatch:", fromMatch);
  
  console.log("all stores found:", findAllStoresInText(combinedText));
`;

eval(evalCode);
