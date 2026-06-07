const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');

async function run() {
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir);
  const emlFiles = files.filter(f => f.endsWith('.eml'));
  
  console.log(`Searching through ${emlFiles.length} EML files...`);
  
  const subjects = [];
  let count = 0;
  for (const file of emlFiles) {
    const filePath = path.join(uploadsDir, file);
    try {
      const content = fs.readFileSync(filePath);
      const parsed = await simpleParser(content);
      const subject = parsed.subject || "";
      if (subject.toLowerCase().includes('hastings') || subject.toLowerCase().includes('blue lagoon') || subject.toLowerCase().includes('albany') || subject.toLowerCase().includes('wairau')) {
        console.log(`File: ${file} | Subject: ${subject}`);
        count++;
        if (count > 30) break;
      }
    } catch (e) {
      // ignore
    }
  }
}

run().catch(console.error);
