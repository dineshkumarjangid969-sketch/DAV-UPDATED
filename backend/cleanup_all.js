const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  try {
    // 1. Delete ALL garbage "Celebrating" orders
    const [celebRes] = await sequelize.query(`DELETE FROM orders WHERE normalized_data LIKE '%Celebrating%'`);
    console.log('Deleted Celebrating orders');

    // 2. Delete ALL garbage "COLLECTION x1" product orders (BT_ prefix, no real invoice)
    const [collRes] = await sequelize.query(`DELETE FROM orders WHERE order_number LIKE 'BT_%' AND normalized_data LIKE '%COLLECTION%'`);
    console.log('Deleted COLLECTION garbage orders');

    // 3. Show what's left
    const [remaining] = await sequelize.query(`SELECT id, order_number, email_subject, pickup_store, destination_store FROM orders ORDER BY createdAt DESC`);
    console.log(`\nRemaining orders: ${remaining.length}`);
    for (const r of remaining) {
      console.log(`  ${r.order_number} | ${r.email_subject} | ${r.pickup_store} -> ${r.destination_store}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
