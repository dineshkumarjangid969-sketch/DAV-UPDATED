const { Sequelize, DataTypes, Op } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'dav_transport.db', logging: false });
const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  order_number: { type: DataTypes.STRING(50) },
  invoice_number: { type: DataTypes.STRING(50) }
});
function truncateTo6Digits(val) {
  if (!val || val === 'Not identified') return val;
  const cleaned = val.replace(/\D/g, '');
  if (cleaned.length >= 6) {
    const digitsMatch = cleaned.match(/\d{6}$/);
    if (digitsMatch) return digitsMatch[0];
  }
  return val;
}
async function t() {
  const orders = await Order.findAll();
  let updated = 0;
  for (let o of orders) {
    let newOrder = truncateTo6Digits(o.order_number);
    let newInvoice = truncateTo6Digits(o.invoice_number);
    if (newOrder !== o.order_number || newInvoice !== o.invoice_number) {
      await o.update({ order_number: newOrder, invoice_number: newInvoice });
      updated++;
    }
  }
  console.log('Updated', updated, 'orders');
}
t();
