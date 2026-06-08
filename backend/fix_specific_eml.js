const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { simpleParser } = require('mailparser');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

async function run() {
  try {
    const [orders] = await sequelize.query(`SELECT id, email_subject, order_number, invoice_number FROM orders WHERE invoice_number IN ('210900', '210563') OR order_number IN ('210900', '210563')`);
    console.log(`Found ${orders.length} target orders`);

    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.endsWith('.eml'))
      .map(f => ({ name: f, time: fs.statSync(path.join(uploadsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 100); // Only process newest 100
    
    let matched = 0;
    for (const fileObj of files) {
      const filePath = path.join(uploadsDir, fileObj.name);
      const content = fs.readFileSync(filePath);
      const parsed = await simpleParser(content);
      const subject = parsed.subject;
      if (!subject) continue;
      
      for (const order of orders) {
        if (subject.includes(order.email_subject) || order.email_subject.includes(subject)) {
          await sequelize.query(`UPDATE orders SET email_screenshot_path = '${filePath.replace(/'/g, "''").replace(/\\/g, '/')}' WHERE id = '${order.id}'`);
          console.log(`Matched ${order.invoice_number || order.order_number} to ${fileObj.name}`);
          matched++;
          order.email_subject = 'MATCHED_DO_NOT_MATCH_AGAIN';
        }
      }
    }
    console.log(`Successfully matched and backfilled ${matched} target orders.`);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
run();
