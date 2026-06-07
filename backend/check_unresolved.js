const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

async function run() {
  const [results] = await sequelize.query(`
    SELECT id, order_number, invoice_number, email_subject, email_from, normalized_data, createdAt 
    FROM orders 
    ORDER BY createdAt DESC
  `);
  
  console.log(`Total orders: ${results.length}`);
  let unidentifiedCount = 0;
  for (const r of results) {
    const norm = JSON.parse(r.normalized_data || '{}');
    const isUnidentified = 
      norm.invoiceNo === 'Not identified' || 
      norm.comingFrom === 'Not identified' || 
      norm.destination === 'Not identified';
      
    if (isUnidentified) {
      unidentifiedCount++;
      console.log(`\n========================================`);
      console.log(`ID: ${r.id}`);
      console.log(`Subject: ${r.email_subject}`);
      console.log(`From: ${r.email_from}`);
      console.log(`Created: ${r.createdAt}`);
      console.log(`Normalized: ${JSON.stringify(norm, null, 2)}`);
      
      // Print first 500 chars of body if exists
      if (norm.sourceEmailBody) {
        console.log(`Body Snippet:\n${norm.sourceEmailBody.substring(0, 500)}...`);
      }
    }
  }
  console.log(`\nUnidentified count: ${unidentifiedCount} / ${results.length}`);
  await sequelize.close();
}

run().catch(console.error);
