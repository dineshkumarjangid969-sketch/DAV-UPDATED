const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  const [results] = await sequelize.query(`
    SELECT id, order_number, invoice_number, attachment_paths, email_subject, createdAt, normalized_data
    FROM orders 
    WHERE id IN ('oice', 'please', '50/')
  `);
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
})();
