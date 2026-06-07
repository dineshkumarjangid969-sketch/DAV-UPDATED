const { normalizeOrderExtraction } = require('./server.js');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  pickup_store: { type: DataTypes.STRING },
  destination_store: { type: DataTypes.STRING },
  email_subject: { type: DataTypes.STRING },
  raw_email_body: { type: DataTypes.TEXT },
  raw_html: { type: DataTypes.TEXT },
  email_from: { type: DataTypes.STRING },
  normalized_data: { type: DataTypes.JSON }
}, { tableName: 'orders', timestamps: true });

(async () => {
  try {
    const orders = await Order.findAll();
    for (const o of orders) {
      if (o.email_subject && o.email_subject.includes('342578')) {
        console.log('--- Order 342578 ---');
        console.log('DB Pickup:', o.pickup_store);
        console.log('DB Dest:', o.destination_store);
        const doclings = o.normalized_data && o.normalized_data.sourceAttachments ? [{ filename: o.normalized_data.sourceAttachments[0], text: o.raw_email_body }] : [];
        // Actually, doclings text is hard to mock correctly here without full DB payload
        // But let's check what combined text would be
        const body = o.raw_email_body || "";
        console.log('Raw Body:', body);
      }
    }
  } catch(e) {
    console.error(e);
  }
})();
