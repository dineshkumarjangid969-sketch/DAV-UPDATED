const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  const [results] = await sequelize.query(`SELECT attachment_paths FROM orders WHERE order_number="228650"`);
  console.log(results[0].attachment_paths);
  process.exit(0);
})();
