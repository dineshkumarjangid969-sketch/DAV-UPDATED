function extractInvoiceNo(combinedContent) {
  // First try high-priority Harvey Norman order formats (e.g. PONZ0220000341874, NZ0220000341874, NZ-022-3831432)
  const hnPattern = /(?:PONZ|SONZ|NZ|PO|SO|Invoice|Inv|Order|PO#|SO#)[:\s#\-_]*([A-Z0-9]*NZ[\d\-]{5,})/gi;
  let hnMatch;
  while ((hnMatch = hnPattern.exec(combinedContent)) !== null) {
    const val = hnMatch[1].trim();
    if (val.length >= 5) return val;
  }
  
  const simpleHnPattern = /\b(NZ[\d\-]{5,})\b/gi;
  let simpleHnMatch;
  while ((simpleHnMatch = simpleHnPattern.exec(combinedContent)) !== null) {
    return simpleHnMatch[1].trim();
  }

  // Regexes with optional middle modifiers (reprint, copy, status, date, no, number)
  const patterns = [
    /\b(?:INV|INVOICE|PO|SO|Order|Ref|Transaction)\b(?:\s+(?:reprint|copy|duplicate|original|status|date|no|number|tax|invoice|report|purchase|sales|re-print))*[:\s#\-_]+([A-Z0-9\-_\/]+)/gi
  ];
  
  const blacklist = /^(and|to|for|the|from|with|status|subject|date|page|image|attached|please|ready|collect|collecting|accepted|pending|scan|scanned|attached|find|re|reprint|re-print|copy|duplicate|original|invoice|order|draft|statement|report|pos|paid|unpaid|cancelled|yes|no|nil|null|none|details|transaction|type|cash|sale|assistant|operator|location|phone|receipt)$/i;

  for (const pat of patterns) {
    let match;
    pat.lastIndex = 0;
    while ((match = pat.exec(combinedContent)) !== null) {
      const val = match[1].trim();
      console.log(`Matched pattern ${pat}: Captured "${val}"`);
      if (val.length >= 3 && !blacklist.test(val) && !val.includes("@") && !/dav/i.test(val)) {
        return val;
      }
    }
  }
  
  return "Not identified";
}

const doclingText = `
 ## Harvey Norman Bedding Whangarei
5 Gumdigger Place
Whangarei  NZ
Phone: (09) 470 0300
===================================================================
Reprinted : 01/06/26 10:48:50
Assistant : 5753/58 SHYAM                    Date        : 01/06/26
Operator  : 5753/58 Shyam                    Time        : 10:06:50
Customer  : 0277818177                       Location    : 28
Sales Type: CASH SALE                        Transaction : 6625423
Gift Receipt                             INVOICE REPRINT 28/2860161
LAURA FITZGERALD
MAUNU
455 CEMETARY RD
WHANGAREI 0110
`;

const result = extractInvoiceNo(doclingText);
console.log("Result:", result);
