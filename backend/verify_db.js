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
  raw_email_body: { type: DataTypes.TEXT }
}, { tableName: 'orders', timestamps: true });

(async () => {
  try {
    const orders = await Order.findAll();
    let hasUnidentified = false;
    for (const o of orders) {
      if (o.pickup_store === 'Not identified' || o.destination_store === 'Not identified') {
        hasUnidentified = true;
        console.log('--- Unidentified in DB ---');
        console.log('DB pickup:', o.pickup_store);
        console.log('DB dest:', o.destination_store);
        console.log('Subject:', o.email_subject);
      }
    }
    if (!hasUnidentified) {
      console.log('All orders successfully identified in the DB!');
    }
  } catch(e) {
    console.error(e);
  }
})();
