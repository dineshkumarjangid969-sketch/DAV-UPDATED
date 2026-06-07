const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING, primaryKey: true },
  order_number: DataTypes.STRING,
  invoice_number: DataTypes.STRING,
  line_items: DataTypes.JSON,
}, { timestamps: true });

async function run() {
  await sequelize.authenticate();
  const orders = await Order.findAll({
    where: {
      id: ['5214306', '2657719', '214306', '657719']
    }
  });
  console.log(JSON.stringify(orders.map(o => ({
    id: o.id,
    order_number: o.order_number,
    invoice_number: o.invoice_number,
    line_items: o.line_items
  })), null, 2));
  process.exit(0);
}
run();
