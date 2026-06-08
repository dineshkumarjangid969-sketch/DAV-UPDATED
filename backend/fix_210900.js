const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { parseEmailContext } = require('./server'); // Need to export these or just copy them

// Actually I can just write a script to update the DB directly, and show that the rules are fixed for future emails.
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

async function fixOrders() {
  try {
    const [orders] = await sequelize.query(`
      SELECT id, invoice_number, order_number, bt_from, bt_to, billing_party
      FROM orders
      WHERE invoice_number IN ('210900', '210563')
         OR order_number IN ('210900', '210563')
    `);

    for (const order of orders) {
      console.log(`Fixing order ${order.invoice_number || order.order_number}`);
      // Based on the email text we inspected earlier:
      // "Can you please collect BT from Mt.wellington and deliver it Lower hutt."
      // comingFrom = Mt Wellington
      // destination = Lower Hutt
      // billing_party = Lower Hutt (since it's a branch transfer, bill to destination)
      
      await sequelize.query(`
        UPDATE orders 
        SET bt_from = 'Mt Wellington',
            bt_to = 'Lower Hutt',
            pickup_store = 'Mt Wellington',
            destination_store = 'Lower Hutt',
            billing_party = 'Lower Hutt',
            location = 'Lower Hutt',
            normalized_data = json_set(
                IFNULL(normalized_data, '{}'), 
                '$.comingFrom', 'Mt Wellington',
                '$.destination', 'Lower Hutt',
                '$.billTo', 'Lower Hutt'
            )
        WHERE id = '${order.id}'
      `);
      console.log(`Updated ${order.id}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

fixOrders();
