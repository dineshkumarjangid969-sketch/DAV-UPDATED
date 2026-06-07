const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const EmailAttachment = sequelize.define('EmailAttachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: DataTypes.STRING(50),
  filename: DataTypes.STRING(255),
  file_path: DataTypes.STRING(500),
}, { tableName: 'email_attachments', timestamps: true });

(async () => {
  try {
    const atts1 = await EmailAttachment.findAll({ where: { order_id: '264405' } });
    console.log('--- 264405 ---');
    console.log(atts1.map(a => a.file_path));

    const atts2 = await EmailAttachment.findAll({ where: { order_id: '132810' } });
    console.log('--- 132810 ---');
    console.log(atts2.map(a => a.file_path));

  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
