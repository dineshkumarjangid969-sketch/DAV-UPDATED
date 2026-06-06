const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

async function run() {
  const [results] = await sequelize.query(`
    SELECT COUNT(*) as count FROM orders WHERE email_screenshot_path IS NOT NULL AND email_screenshot_path != ''
  `);
  console.log(`Orders with EML paths: ${results[0].count}`);
  
  const [total] = await sequelize.query(`
    SELECT COUNT(*) as count FROM orders
  `);
  console.log(`Total orders: ${total[0].count}`);
  
  const [attachments] = await sequelize.query(`
    SELECT COUNT(*) as count FROM email_attachments
  `);
  console.log(`Total attachments: ${attachments[0].count}`);
  
  await sequelize.close();
}

run().catch(console.error);
