const { normalizeOrderExtraction } = require('./server.js');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  email_subject: { type: DataTypes.STRING },
  raw_email_body: { type: DataTypes.TEXT },
  docling_data: { type: DataTypes.TEXT }
}, { tableName: 'orders', timestamps: true });

(async () => {
  try {
    const o = await Order.findByPk('BT_Albany_20260604_1316');
    if (o) {
      const doclings = o.docling_data ? JSON.parse(o.docling_data) : [];
      const res = normalizeOrderExtraction(o.email_subject, "unknown@email.com", o.raw_email_body, "", doclings);
      console.log('--- Order ---');
      console.log('Subject:', o.email_subject);
      console.log('Order No:', res.order_number);
      console.log('Invoice No:', res.invoice_number);
      console.log('Products:', JSON.stringify(res.products, null, 2));
      console.log('ComingFrom:', res.comingFrom);
      console.log('Destination:', res.destination);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
