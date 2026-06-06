const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  // Get orders with empty products that mention product names in their body text
  const [rows] = await sq.query(`
    SELECT id, order_number, raw_email_body, email_subject
    FROM orders 
    WHERE (line_items IS NULL OR line_items = '' OR line_items = '[]' OR line_items = 'Not identified')
    AND raw_email_body IS NOT NULL AND raw_email_body != ''
    LIMIT 15
  `);
  
  for (const row of rows) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Order: ${row.id} (${row.order_number})`);
    console.log(`Subject: ${row.email_subject}`);
    console.log(`Body (first 600):`);
    console.log(row.raw_email_body.substring(0, 600));
    console.log(`${'='.repeat(80)}`);
  }
  
  process.exit(0);
})();
