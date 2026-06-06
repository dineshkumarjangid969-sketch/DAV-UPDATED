const fs = require('fs');
const { EmailScanner } = require('./server.js');

(async () => {
  const scanner = new EmailScanner();
  const rawEmail = fs.readFileSync('oice_email.eml', 'utf8');
  const account = { email: 'test@gmail.com' };
  
  console.log('Processing oice_email.eml...');
  try {
    const orders = await scanner.processMessage(rawEmail, account);
    console.log(JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();
