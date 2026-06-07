const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

async function run() {
  const [results] = await sequelize.query(`
    SELECT id, email_subject, email_from FROM orders WHERE email_screenshot_path IS NULL OR email_screenshot_path = ''
  `);
  
  console.log(`Unlinked orders count: ${results.length}`);
  for (const r of results) {
    console.log(`ID: ${r.id} | Subject: ${r.email_subject} | From: ${r.email_from}`);
  }
  await sequelize.close();
}

run().catch(console.error);
