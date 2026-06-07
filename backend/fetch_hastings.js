const { Sequelize, DataTypes } = require('sequelize');
const { normalizeOrderExtraction } = require('./server.js');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  invoice_no: { type: DataTypes.STRING },
  pickup_store: { type: DataTypes.STRING },
  destination_store: { type: DataTypes.STRING },
  source_email_subject: { type: DataTypes.STRING },
  source_email_body: { type: DataTypes.TEXT },
  raw_html: { type: DataTypes.TEXT },
  docling_data: { type: DataTypes.TEXT }
}, { tableName: 'orders', timestamps: true });

(async () => {
  const orders = await Order.findAll();
  for (const o of orders) {
    if (o.source_email_subject && o.source_email_subject.includes('Hastings')) {
      const doclings = o.docling_data ? JSON.parse(o.docling_data) : [];
      const res = normalizeOrderExtraction(o.source_email_subject, "unknown@email.com", o.source_email_body, o.raw_html, doclings);
      console.log('--- Hastings Order ---');
      console.log('DB comingFrom:', o.pickup_store);
      console.log('DB destination:', o.destination_store);
      console.log('New comingFrom:', res.comingFrom);
      console.log('New destination:', res.destination);
      console.log('Subject:', res.sourceEmailSubject);
      console.log('---');
    }
  }
})();
