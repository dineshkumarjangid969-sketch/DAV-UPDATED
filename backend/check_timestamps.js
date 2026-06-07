const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  try {
    const [results] = await sequelize.query(`
      SELECT order_number, createdAt, email_subject 
      FROM orders 
      WHERE order_number IN ("BT_a138aae2", "BT_b73bcbd6", "BT_45610017", "228650")
    `);
    console.log(JSON.stringify(results, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
