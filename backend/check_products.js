const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  // Check what line_items values look like for the "not identified" ones
  const [rows] = await sq.query(`
    SELECT line_items, count(*) as cnt 
    FROM Orders 
    GROUP BY line_items 
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('=== line_items distribution ===');
  rows.forEach(r => console.log(`  "${(r.line_items || 'NULL').substring(0,100)}" => ${r.cnt}`));
  
  // Get some samples of orders with empty/null line_items that DO have data elsewhere
  const [samples] = await sq.query(`
    SELECT id, order_number, invoice_number, bt_from, pickup_store, client_name, email_subject, 
           line_items, raw_email_body, normalized_data 
    FROM Orders 
    WHERE (line_items IS NULL OR line_items = '' OR line_items = '[]' OR line_items = 'Not identified')
    LIMIT 8
  `);
  
  for (const row of samples) {
    console.log('\n=== Order ID:', row.id, '===');
    console.log('order_number:', row.order_number);
    console.log('invoice_number:', row.invoice_number);
    console.log('bt_from:', row.bt_from);
    console.log('pickup_store:', row.pickup_store);
    console.log('client_name:', row.client_name);
    console.log('email_subject:', row.email_subject);
    console.log('line_items:', row.line_items);
    console.log('raw_email_body (first 800):', (row.raw_email_body || '').substring(0, 800));
    console.log('normalized_data (first 800):', (row.normalized_data || '').substring(0, 800));
  }
  
  process.exit(0);
})();
