const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  const [orders] = await sequelize.query(`SELECT id FROM orders WHERE order_number="228650"`);
  if (orders.length > 0) {
    const order_id = orders[0].id;
    const [attachments] = await sequelize.query(`SELECT filename, file_path FROM email_attachments WHERE order_id="${order_id}"`);
    console.log("ATTACHMENTS:", attachments);
  }
  process.exit(0);
})();
