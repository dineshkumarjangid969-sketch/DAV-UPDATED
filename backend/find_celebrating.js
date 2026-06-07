const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT id, order_number, invoice_number, pickup_store, destination_store, email_subject 
      FROM orders 
      WHERE normalized_data LIKE '%Celebrating%' 
         OR pickup_store LIKE '%Celebrating%' 
         OR destination_store LIKE '%Celebrating%'
         OR order_number LIKE '%Celebrating%'
    `);
    console.log(JSON.stringify(results, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
