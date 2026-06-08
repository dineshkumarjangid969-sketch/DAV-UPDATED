const { Sequelize } = require('sequelize');
const seq = new Sequelize({dialect:'sqlite', storage:'dav_transport.db', logging:false});

(async () => {
  const [order] = await seq.query("SELECT id, order_number, normalized_data, line_items FROM Orders WHERE id = '228650'");
  if (order.length > 0) {
    const o = order[0];
    console.log("=== Order 228650 ===");
    
    // Check line_items
    const items = typeof o.line_items === 'string' ? JSON.parse(o.line_items || '[]') : (o.line_items || []);
    console.log(`\n=== Line Items (${items.length}) ===`);
    items.forEach((it, i) => console.log(`  [${i}] sku=${it.sku}, qty=${it.quantity}, desc=${it.description}`));
    
    // Check normalized_data
    const nd = typeof o.normalized_data === 'string' ? JSON.parse(o.normalized_data || '{}') : (o.normalized_data || {});
    if (nd.products) {
      console.log(`\n=== Normalized Products (${nd.products.length}) ===`);
      nd.products.forEach((p, i) => console.log(`  [${i}] sku=${p.sku}, qty=${p.quantity}, desc=${p.description}`));
    }
    if (nd.sourceAttachments) {
      console.log(`\n=== Attachments (${nd.sourceAttachments.length}) ===`);
      nd.sourceAttachments.forEach((a, i) => console.log(`  [${i}] ${a}`));
    }
  } else {
    console.log("Order 228650 not found");
  }
  await seq.close();
})();
