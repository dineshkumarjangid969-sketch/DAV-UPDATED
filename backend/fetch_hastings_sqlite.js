const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
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
}, { tableName: 'Orders', timestamps: true }); // uppercase O!

(async () => {
  try {
    const orders = await Order.findAll();
    for (const o of orders) {
      if (o.source_email_subject && o.source_email_subject.includes('Hastings')) {
        console.log('--- Hastings Order ---');
        console.log('DB pickup:', o.pickup_store);
        console.log('DB dest:', o.destination_store);
        console.log('Subject:', o.source_email_subject);
        console.log('Body:', o.source_email_body);
        console.log('---');
      }
    }
  } catch(e) {
    console.error(e);
  }
})();
