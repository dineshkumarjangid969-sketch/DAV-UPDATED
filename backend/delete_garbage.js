const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  try {
    await sequelize.query(`
      DELETE FROM orders 
      WHERE email_subject LIKE '%Hamilton 2 seater%' AND (
        normalized_data LIKE '%Celebrating%' OR 
        pickup_store LIKE '%Celebrating%' OR 
        destination_store LIKE '%Celebrating%'
      )
    `);
    console.log('Deleted garbage orders');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
