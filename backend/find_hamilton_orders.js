const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT id, order_number, invoice_number, pickup_store, destination_store, email_subject, attachment_paths, normalized_data 
      FROM orders 
      WHERE email_subject LIKE '%Hamilton 2 seater%'
    `);
    console.log(JSON.stringify(results, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
