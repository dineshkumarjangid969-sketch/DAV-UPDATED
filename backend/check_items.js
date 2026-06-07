const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  email_subject: { type: DataTypes.STRING },
  raw_email_body: { type: DataTypes.TEXT },
  normalized_data: { type: DataTypes.JSON },
  line_items: { type: DataTypes.JSON }
}, { tableName: 'orders', timestamps: true });

(async () => {
  try {
    const o1 = await Order.findByPk('264405');
    console.log('--- Order 264405 ---');
    console.log('Items:', o1?.line_items);
    console.log('Norm Data:', JSON.stringify(o1?.normalized_data?.products));
    
    const o2 = await Order.findByPk('132810');
    console.log('--- Order 132810 ---');
    console.log('Items:', o2?.line_items);
    console.log('Norm Data:', JSON.stringify(o2?.normalized_data?.products));
    
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
