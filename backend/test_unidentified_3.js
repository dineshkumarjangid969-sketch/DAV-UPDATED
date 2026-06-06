const fs = require('fs');
const { normalizeOrderExtraction } = require('./server.js');

const txt = fs.readFileSync('unresolved_utf8.txt', 'utf8'); 
let emailData; 
const blocks = txt.split('==='); 
for(let b of blocks) { 
  if(b.includes('Urgent BT from Lowerhutt')) { 
    const m1 = b.match(/"sourceEmailSubject":\s*"([^"]+)"/); 
    const m2 = b.match(/"sourceEmailBody":\s*"([\s\S]+?)"/); 
    if(m1 && m2) { 
      emailData = {subject: m1[1], body: m2[1]}; 
      break; 
    } 
  } 
}

if (emailData) {
  const res = normalizeOrderExtraction(emailData.subject, "from@example.com", emailData.body, "", []);
  console.log("Order No:", res.order_number);
  console.log("Invoice No:", res.invoice_number);
} else {
  console.log("Not found in unresolved_utf8.txt");
}
