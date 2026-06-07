const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  try {
    const subjects = [
      'Fwd: BT Collection From Wairau Park to Lower Hutt',
      'Fwd: BT Collection From Westgate to Lower Hutt',
      'Fwd: Hamilton 2 seater',
      'Fwd: FW: PO# NZ0280000228650 - Order Status = Accepted (Pending) - Ready to Collect Whangarei BT collection from Manuaku'
    ];

    for (const subj of subjects) {
      console.log(`\n\n======================================`);
      console.log(`SUBJECT: ${subj}`);
      const [results] = await sequelize.query(`
        SELECT id, order_number, pickup_store, destination_store, line_items, raw_email_body, normalized_data, attachment_paths
        FROM orders
        WHERE email_subject LIKE ?
        ORDER BY createdAt DESC LIMIT 1
      `, { replacements: [`%${subj.replace('Manuaku', 'Manuaku').substring(0, 50)}%`] });

      if (results.length > 0) {
        const order = results[0];
        console.log(`ORDER NUMBER: ${order.order_number}`);
        console.log(`PICKUP: ${order.pickup_store} | DEST: ${order.destination_store}`);
        console.log(`LINE ITEMS: ${order.line_items}`);
        console.log(`ATTACHMENTS: ${order.attachment_paths}`);
        const parsedData = JSON.parse(order.normalized_data);
        console.log(`PRODUCTS in JSON: ${JSON.stringify(parsedData.products)}`);
        
        console.log(`\n--- RAW BODY (Snippet) ---`);
        console.log((order.raw_email_body || '').substring(0, 300).replace(/\n/g, ' '));
      } else {
        console.log(`NOT FOUND in DB.`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
