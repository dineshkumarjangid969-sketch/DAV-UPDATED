const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

async function run() {
  try {
    const [orders] = await sequelize.query(`SELECT id, email_subject, order_number FROM orders WHERE email_screenshot_path IS NULL`);
    console.log(`Found ${orders.length} orders missing email_screenshot_path`);

    const uploadsDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.eml'));
    
    let matched = 0;
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const content = fs.readFileSync(filePath);
      const parsed = await simpleParser(content);
      const subject = parsed.subject;
      
      if (!subject) continue;
      
      for (const order of orders) {
        if (order.email_subject === subject) {
          await sequelize.query(`UPDATE orders SET email_screenshot_path = '${filePath.replace(/'/g, "''")}' WHERE id = '${order.id}'`);
          matched++;
          break; // Move to next file
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
