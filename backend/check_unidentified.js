const { EmailScanner, normalizeOrderExtraction } = require('./server.js');
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
}, { tableName: 'orders', timestamps: true });

(async () => {
  const orders = await Order.findAll();
  let unidentified = 0;
  for (const o of orders) {
    const doclings = o.docling_data ? JSON.parse(o.docling_data) : [];
    const res = normalizeOrderExtraction(o.source_email_subject, "unknown@email.com", o.source_email_body, o.raw_html, doclings);
    
    if (res.comingFrom === 'Not identified' || res.destination === 'Not identified') {
      unidentified++;
      console.log('--- Unidentified Order ---');
      console.log('Invoice:', res.invoiceNo);
      console.log('Subject:', res.sourceEmailSubject);
      console.log('ComingFrom:', res.comingFrom);
      console.log('Destination:', res.destination);
    }
  }
  console.log(`Total orders still unidentified: ${unidentified}`);
  process.exit(0);
})();
