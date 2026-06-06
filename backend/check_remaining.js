const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  const [rows] = await sq.query(`
    SELECT id, order_number, invoice_number, line_items, bt_from, pickup_store, 
           email_subject, attachment_paths, raw_email_body
    FROM orders 
    WHERE (line_items IS NULL OR line_items = '' OR line_items = '[]' OR line_items = 'Not identified')
  `);
  
  console.log(`Remaining unidentified products: ${rows.length}\n`);
  
  for (const row of rows) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ID: ${row.id}`);
    console.log(`Order#: ${row.order_number}`);
    console.log(`Invoice#: ${row.invoice_number}`);
    console.log(`From: ${row.bt_from}`);
    console.log(`Subject: ${row.email_subject}`);
    console.log(`Attachment paths: ${(row.attachment_paths || 'none').substring(0, 200)}`);
    console.log(`Body (first 300): ${(row.raw_email_body || 'NONE').substring(0, 300)}`);
    console.log(`${'='.repeat(60)}`);
  }
  
  process.exit(0);
})();
