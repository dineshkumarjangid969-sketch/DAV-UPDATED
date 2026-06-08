const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

async function inspectOrders() {
  try {
    const [orders] = await sequelize.query(`
      SELECT id, invoice_number, bt_from, bt_to, billing_party, normalized_data, line_items, email_subject
      FROM orders
      WHERE invoice_number IN ('210900', '210563')
         OR order_number IN ('210900', '210563')
    `);

    for (const order of orders) {
      console.log(`\n===========================================`);
      console.log(`Order: ${order.invoice_number} / ID: ${order.id}`);
      console.log(`From: ${order.bt_from}`);
      console.log(`To: ${order.bt_to}`);
      console.log(`Billing: ${order.billing_party}`);
      console.log(`Subject: ${order.email_subject}`);
      console.log(`Normalized:\n`, JSON.stringify(JSON.parse(order.normalized_data || '{}'), null, 2));
    }
    
    // Also fetch the email bodies to see what we're working with
    const [emails] = await sequelize.query(`
      SELECT order_id, filename, file_path
      FROM email_attachments
      WHERE order_id IN (
        SELECT id FROM orders WHERE invoice_number IN ('210900', '210563') OR order_number IN ('210900', '210563')
      )
    `);
    
    console.log(`\nAttachments found:`, emails);

  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

inspectOrders();
