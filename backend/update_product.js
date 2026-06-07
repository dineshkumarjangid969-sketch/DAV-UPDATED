const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  line_items: { type: DataTypes.JSON },
}, { tableName: 'orders', timestamps: false });

(async () => {
  try {
    const o = await Order.findByPk('132810');
    if (o) {
      let items = o.line_items || [];
      // Remove any incorrect generic items if present, or just append the correct one
      const correctItem = { sku: '', quantity: 1, description: 'EIGN SUPREME II FIRM QUN MAT' };
      
      // Prevent duplicates
      const exists = items.find(i => i.description === correctItem.description);
      if (!exists) {
        items.push(correctItem);
      }
      
      o.line_items = items;
      await o.save();
      console.log('Successfully updated 132810 with EIGN SUPREME II FIRM QUN MAT');
    } else {
      console.log('Order 132810 not found');
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
