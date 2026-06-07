const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');
const EmailScanner = require('./EmailScanner');

async function testProcess() {
  try {
    // We don't have the .eml files handy, but wait, do we have them in the 'uploads' folder?
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadsDir);
    const emlFiles = files.filter(f => f.endsWith('.eml'));
    
    if (emlFiles.length === 0) {
      console.log("No .eml files found in uploads.");
      return;
    }
    
    const targetEml = emlFiles.find(f => {
      const content = fs.readFileSync(path.join(uploadsDir, f), 'utf8');
      return content.includes('Lowerhutt') || content.includes('NEW PLYMOUTH AND PORIRUA') || content.includes('Wairau Park to Hastings');
    });
    
    if (!targetEml) {
        console.log("Could not find the target EML file.");
        return;
    }
    
    console.log(`Found target EML: ${targetEml}`);
    const rawEmail = fs.readFileSync(path.join(uploadsDir, targetEml));
    const parsed = await simpleParser(rawEmail);
    
    // Call processMessage (make it accessible or just paste the logic)
    // Actually EmailScanner doesn't export processMessage directly easily since it's inside the class instance.
    // Let's instantiate EmailScanner.
    const scanner = new EmailScanner();
    const result = await scanner.processMessage(parsed, rawEmail);
    console.log("Process Result:", JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error(err);
  }
}

testProcess();
