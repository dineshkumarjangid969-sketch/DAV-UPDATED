const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

async function run() {
  try {
    const [orders] = await sequelize.query(`SELECT id, email_subject, order_number, invoice_number FROM orders WHERE email_screenshot_path IS NULL`);
    console.log(`Found ${orders.length} orders missing email_screenshot_path`);

    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.eml'));
    
    let matched = 0;
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      // Read first 2KB which usually contains the headers
      const buffer = Buffer.alloc(2048);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 2048, 0);
      fs.closeSync(fd);
      
      const content = buffer.toString('utf-8');
      const subjectMatch = content.match(/^Subject:\s*(.+)$/im);
      if (!subjectMatch) continue;
      
      const subject = subjectMatch[1].trim();
      
      for (const order of orders) {
        if (order.email_subject === subject || (order.email_subject && subject.includes(order.email_subject))) {
          await sequelize.query(`UPDATE orders SET email_screenshot_path = '${filePath.replace(/'/g, "''")}' WHERE id = '${order.id}'`);
          matched++;
          order.email_subject = 'MATCHED_DO_NOT_MATCH_AGAIN'; // prevent multiple matches to same order
        }
      }
    }
    console.log(`Successfully matched and backfilled ${matched} orders with their .eml paths.`);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}
run();
