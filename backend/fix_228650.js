const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('order', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  order_number: DataTypes.STRING,
  normalized_data: { type: DataTypes.JSON, defaultValue: {} },
  line_items: { type: DataTypes.JSON, defaultValue: [] },
});
const EmailAttachment = sequelize.define('email_attachment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  order_id: DataTypes.STRING,
  filename: DataTypes.STRING,
  file_path: DataTypes.STRING,
});

(async () => {
  const { normalizeOrderExtraction } = require('./server.js');
  const pdfParse = require('pdf-parse');

  const order = await Order.findOne({ where: { order_number: '228650' } });
  if (!order) return;

  const attachments = await EmailAttachment.findAll({ where: { order_id: order.id } });
  const doclings = [];

  for (const file of attachments) {
    if (!file.file_path || !fs.existsSync(file.file_path)) continue;
    const ext = path.extname(file.filename || '').toLowerCase();
    
    if (ext === '.pdf') {
      try {
        const buffer = fs.readFileSync(file.file_path);
        const pdfData = await pdfParse(buffer);
        if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
          doclings.push({ filename: file.filename, attPath: file.file_path, raw_markdown: pdfData.text, raw_tables: [] });
          console.log(`Extracted text from ${file.filename}, len=${pdfData.text.length}`);
        }
      } catch (e) {
        console.error("PDF Parse error", e);
      }
    }
  }

  const normalized = normalizeOrderExtraction(order.email_subject || '', order.email_from || '', order.raw_email_body || '', '', doclings);
  console.log("EXTRACTED PRODUCTS:", JSON.stringify(normalized.products, null, 2));

  // Update DB!
  order.line_items = normalized.products;
  order.normalized_data = normalized;
  await order.save();
  console.log("Saved order 228650.");
  
  process.exit(0);
})();
