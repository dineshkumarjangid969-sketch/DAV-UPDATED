const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  raw_email_body: { type: DataTypes.TEXT },
}, { tableName: 'orders', timestamps: true });

(async () => {
  const o = await Order.findByPk('132810');
  console.log(o?.raw_email_body);
  process.exit(0);
})();
