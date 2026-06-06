const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  const queries = [
    ['total', "SELECT count(*) as c FROM Orders"],
    ['niInv', "SELECT count(*) as c FROM Orders WHERE invoice_number = 'Not identified'"],
    ['niProd', "SELECT count(*) as c FROM Orders WHERE line_items = 'Not identified' OR line_items IS NULL OR line_items = '[]'"],
    ['niFrom', "SELECT count(*) as c FROM Orders WHERE bt_from = 'Not identified' OR bt_from IS NULL"],
    ['niStore', "SELECT count(*) as c FROM Orders WHERE pickup_store = 'Not identified' OR pickup_store IS NULL"],
    ['niClient', "SELECT count(*) as c FROM Orders WHERE client_name = 'Not identified' OR client_name IS NULL"],
    ['niType', "SELECT count(*) as c FROM Orders WHERE type = 'Not identified' OR type IS NULL"],
  ];
  
  for (const [name, sql] of queries) {
    const [[r]] = await sq.query(sql);
    console.log(name + ': ' + r.c);
  }
  
  // Show 5 sample unidentified orders with their raw data
  const [rows] = await sq.query("SELECT id, order_number, invoice_number, line_items, bt_from, pickup_store, client_name, email_subject, email_from, raw_email_body, normalized_data FROM Orders WHERE invoice_number = 'Not identified' LIMIT 5");
  
  for (const row of rows) {
    console.log('\n=== Order ID:', row.id, '===');
    console.log('order_number:', row.order_number);
    console.log('invoice_number:', row.invoice_number);
    console.log('line_items:', (row.line_items || '').substring(0, 200));
    console.log('bt_from:', row.bt_from);
    console.log('pickup_store:', row.pickup_store);
    console.log('client_name:', row.client_name);
    console.log('email_subject:', row.email_subject);
    console.log('email_from:', row.email_from);
    console.log('raw_email_body (first 500):', (row.raw_email_body || '').substring(0, 500));
    console.log('normalized_data (first 500):', (row.normalized_data || '').substring(0, 500));
  }
  
  process.exit(0);
})();
