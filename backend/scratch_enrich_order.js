// Standalone DB script to avoid conflict
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING, primaryKey: true },
  normalized_data: DataTypes.JSON,
}, { timestamps: false });

let productCatalog = { by_code: {}, names: [] };
try {
  const catalogPath = path.join(__dirname, 'products.json');
  if (fs.existsSync(catalogPath)) {
    productCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  }
} catch (e) {
  console.error('[ProductDB] Failed to load products.json:', e.message);
}

function matchProduct(sku, description) {
  if (sku) {
    const cleanSku = String(sku).replace(/^\*\s*/, '').trim();
    const match = productCatalog.by_code[cleanSku];
    if (match) return match;
  }
  if (description && description.length > 4) {
    const descLower = description.toLowerCase().trim();
    const exactMatch = productCatalog.names.find(p => p.name_lower === descLower);
    if (exactMatch) return exactMatch;
    
    const substringMatch = productCatalog.names.find(p => p.name_lower.includes(descLower) || descLower.includes(p.name_lower));
    if (substringMatch) return substringMatch;
    
    const words = descLower.split(/\s+/).filter(w => w.length > 3);
    if (words.length >= 2) {
      const wordMatch = productCatalog.names.find(p => {
        const matchCount = words.filter(w => p.name_lower.includes(w)).length;
        return matchCount >= Math.min(3, words.length);
      });
      if (wordMatch) return wordMatch;
    }
  }
  return null;
}

async function run() {
  await sequelize.authenticate();
  console.log("Connected to DB.");

  // Find an order to enrich
  const orders = await Order.findAll({ limit: 10, order: [['createdAt', 'DESC']] });
  
  let targetOrder = orders[0];
  if (!targetOrder) {
      console.log("No orders exist.");
      return;
  }
      
  const dummyProducts = [
    { sku: "274601", description: "Charlotte Tilbury Luxury Palette", quantity: 2 },
    { sku: "266649", description: "111Skin Rose Gold Radiance Booster", quantity: 1 },
    { sku: "UNKNOWN", description: "Some unknown generic product", quantity: 3 }
  ];
  
  let orderData = targetOrder.normalized_data || {};
  orderData.products = dummyProducts;
  targetOrder.normalized_data = orderData;

  console.log(`Enriching Order ID: ${targetOrder.id}`);
  
  orderData.products = orderData.products.map(item => {
    // If no SKU but we want to force a match for demo purposes, let's inject a known one if it's the unknown one
    if(item.description.includes("Charlotte") && !item.sku) item.sku = "274601";
    
    const match = matchProduct(item.sku, item.description);
    if (match) {
      console.log(`Matched: ${item.description} -> ${match.name}`);
      return {
        ...item,
        imageUrl: match.imageUrl || '',
        brand: match.brand || '',
        category: match.category || '',
        matchedName: match.name || '',
      };
    }
    console.log(`Unmatched: ${item.description}`);
    return { ...item, imageUrl: '', brand: '', category: '', matchedName: '' };
  });

  targetOrder.normalized_data = orderData;
  targetOrder.changed('normalized_data', true);
  await targetOrder.save();
  
  console.log(`\n✅ Done! Order ${targetOrder.id} has been enriched.`);
  console.log(`Check your dashboard and open Order: ${orderData.invoiceNo || orderData.orderNo || targetOrder.id}`);
}

run().catch(console.error);
