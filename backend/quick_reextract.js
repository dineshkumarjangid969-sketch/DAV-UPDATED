const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING, primaryKey: true },
  order_number: DataTypes.STRING,
  line_items: DataTypes.JSON,
  raw_email_body: DataTypes.TEXT,
  email_subject: DataTypes.STRING
}, { tableName: 'orders', timestamps: false });

const EmailAttachment = sequelize.define('EmailAttachment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: DataTypes.STRING,
  file_path: DataTypes.STRING,
  filename: DataTypes.STRING
}, { tableName: 'email_attachments', timestamps: false });

function extractProducts(body, rawTables, rawMarkdown, doclingLineItems, subject) {
  const products = [];
  const seenDescs = new Set();
  
  function addProduct(sku, quantity, description) {
    if (!description && !sku) return;
    description = (description || sku || "").trim();
    sku = (sku || "").trim();
    if (description.length < 3 && sku.length < 3) return;
    const descNorm = description.toLowerCase().replace(/\s+/g, ' ').trim();
    const skuNorm = sku.toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^(sku|code|item|description|details|total|subtotal|gst|tax|payment|signature|warranty|disclaimer|end of report)$/i.test(description)) return;
    if (/^[\$\d\.,\s]+$/.test(descNorm)) return;
    
    if (/^(external\]|fw:|fwd:|re:|fwd:)/i.test(descNorm)) return;
    if (/(bt from|bt request from)/i.test(descNorm)) return;
    if (/^(purchaseorder|po#|p\/o)/i.test(descNorm.replace(/\s+/g, ''))) return;
    if (/^(rd |st |avenue|highway)/i.test(description)) return;
    if (/^(inv for the reference|order status)/i.test(descNorm)) return;
    
    description = description.replace(/^([\d\.,\s]+)/, '').trim();
    description = description.replace(/ORD:\s*\d+\s*@[\d\.,\sA-Za-z:$\-]+$/i, '').trim();
    
    if (description.length < 3) return;
    
    const key = description.toLowerCase().replace(/\s+/g, ' ');
    if (seenDescs.has(key)) return;
    
    if (/^\d+(\.\d+)?\s*(x|mmt|kg|kgm|cm|mm|m|\*)\s*$/i.test(descNorm)) return;
    
    seenDescs.add(key);
    if (isNaN(quantity) || quantity <= 0) quantity = 1;
    if (!sku || sku === "ITEM") sku = description.split(/\s+/).slice(0, 2).join("-").toUpperCase().replace(/[^A-Z0-9\-]/g, "").substring(0, 20) || "ITEM";
    
    products.push({ sku, quantity: parseInt(quantity, 10) || 1, description });
  }

  const allText = (rawMarkdown || "") + "\n" + (body || "");
  const allLines = allText.split("\n");

  // Strategy 1.5: Markdown table
  if (rawMarkdown) {
    const lines = rawMarkdown.split('\n');
    let inTable = false;
    let headers = [];
    let skuIdx = -1, descIdx = -1, qtyIdx = -1;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|')) {
        const cols = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (cols.length < 2) continue;
        
        if (!inTable) {
          headers = cols.map(h => h.toLowerCase());
          skuIdx = headers.findIndex(h => ["sku", "code", "product code"].some(k => h === k || h.includes(k)));
          descIdx = headers.findIndex((h, i) => i !== skuIdx && ["items", "description", "item name", "product name", "product"].some(k => h.includes(k)));
          qtyIdx = headers.findIndex(h => ["qty", "quantity"].some(k => h.includes(k)));
          if (skuIdx >= 0 || descIdx >= 0) inTable = true;
        } else if (cols[0].includes('---')) {
          continue;
        } else {
          let sku = skuIdx >= 0 && skuIdx < cols.length ? cols[skuIdx] : "";
          let desc = descIdx >= 0 && descIdx < cols.length ? cols[descIdx] : "";
          let qtyStr = qtyIdx >= 0 && qtyIdx < cols.length ? cols[qtyIdx] : "1";
          addProduct(sku, parseInt(qtyStr.replace(/[^\d]/g, ""), 10), desc || sku);
        }
      } else {
        inTable = false;
      }
    }
  }
  
  if (products.length > 0) return products;

  // Strategy 3: P/O Response format / Tape Contents
  const segments = allText.split(/Accepted/i);
  if (segments.length > 1) {
    for (let i = 0; i < segments.length - 1; i++) {
      const product_chunk = segments[i];
      const quantity_chunk = segments[i + 1];
      
      const lines_before = product_chunk.split('\n').map(l => l.trim()).filter(l => l);
      let product_name = "Unknown Product";
      if (lines_before.length > 0) {
        const potential_product = lines_before[lines_before.length - 1];
        if (!potential_product.toLowerCase().includes("supplier invoice")) {
          product_name = potential_product;
        }
      }
      
      const qtyMatch = quantity_chunk.match(/(?:Delv Qty|Delivered qty|Del qty)[:\s]*(\d+)|(\d+)\s*(?:Delv Qty|Delivered qty|Del qty)|RES:?\s*(\d+)/i);
      let quantity = 0;
      if (qtyMatch) quantity = parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3], 10);
      
      if (quantity > 0 && product_name !== "Unknown Product") {
        addProduct("", quantity, product_name);
      }
    }
  }
  
  if (products.length > 0) return products;

  // Strategy 5: Generic line patterns
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    const m1 = line.match(/^[\*\-]?\s*([A-Z0-9\-\/]{3,})\s+(\d+)\s+(.{3,})/i);
    if (m1) {
      addProduct(m1[1].trim(), parseInt(m1[2], 10), m1[3].trim());
      continue;
    }
    const m2 = line.match(/(\d+)\s*(?:x|pcs|units|pieces)\s+(.{4,})/i);
    if (m2 && parseInt(m2[1], 10) <= 200) {
      addProduct("", parseInt(m2[1], 10), m2[2].trim());
    }
  }

  return products;
}

async function run() {
  const orders = await Order.findAll();
  let updated = 0;
  for(let order of orders) {
    const atts = await EmailAttachment.findAll({where: {order_id: order.id}});
    let combinedText = '';
    for(let att of atts) {
      if(att.file_path && fs.existsSync(att.file_path) && att.file_path.endsWith('.pdf')) {
        try {
          const data = await pdfParse(fs.readFileSync(att.file_path));
          combinedText += data.text + '\n';
        } catch(e) {}
      }
    }
    
    // We pass combinedText as rawMarkdown for Strategy 1.5 and 3 to process
    const prods = extractProducts(order.raw_email_body || '', [], combinedText, [], order.email_subject || '');
    
    let currentProds = [];
    try {
      currentProds = typeof order.line_items === 'string' ? JSON.parse(order.line_items) : (order.line_items || []);
    } catch(e) {}
    
    const badProd = currentProds.some(p => p.description && (
      /coastal\s*truck/i.test(p.description) ||
      /^(external\]|fw:|fwd:|re:|fwd:)/i.test(p.description) ||
      /(bt from|bt request from)/i.test(p.description) ||
      /^(purchaseorder|po#|p\/o)/i.test(p.description.replace(/\s+/g, '')) ||
      /^(rd |st |avenue|highway)/i.test(p.description) ||
      /^(inv for the reference|order status)/i.test(p.description)
    ));
    const allPrices = currentProds.length > 0 && currentProds.every(p => /^[\$\d\.,\s]+$/.test(p.description));
    
    if(prods.length > 0 && (badProd || allPrices || currentProds.length === 0)) {
      order.line_items = prods;
      await order.save();
      updated++;
      console.log('Fixed order with valid items:', order.order_number, JSON.stringify(prods));
    } else if (prods.length === 0 && (badProd || allPrices)) {
      order.line_items = [];
      await order.save();
      updated++;
      console.log('Cleared bad items for order:', order.order_number);
    }
  }
  console.log('Updated', updated, 'orders.');
}
run();
