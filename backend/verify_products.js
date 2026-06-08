const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'dav_transport.db', logging: false });

const Order = sequelize.define("Order", {
  id: { type: Sequelize.STRING(50), primaryKey: true },
  order_number: { type: Sequelize.STRING(50), allowNull: false },
  line_items: Sequelize.TEXT,
});

class ExportService {
  _formatProductsForExport(items) {
    if (!Array.isArray(items)) return "";
    return items.map(i => {
      let desc = i.description || "";
      if (desc) {
        desc = desc.replace(/Order\s+\d+\s*/gi, '');
        desc = desc.replace(/@\s*\d+\.\d+\s*TOT:.*$/is, '');
        desc = desc.replace(/(\d+\.\d+\s*){2,}.*$/is, '');
        desc = desc.replace(/Total Ex\.GST.*$/is, '');
        desc = desc.replace(/\*\s*\*\s*\*\s*End of Report.*/is, '');
        desc = desc.replace(/RES:\s*\d+\s*/gi, '');
        desc = desc.replace(/Delv Qty:\s*\d+\s*/gi, '');
        desc = desc.replace(/Est\.Ship:\s*Order\s*Response\s*/gi, '');
        desc = desc.replace(/Manufacturer Warranty.*/is, '');
        desc = desc.replace(/See Manufacturers.*/is, '');
        desc = desc.replace(/:\s*\d+\s*$/g, '');
        desc = desc.replace(/\s+/g, ' ').trim();
      }
      const finalName = desc && desc.length > 2 ? desc : (i.sku || "Unknown");
      return `${finalName} x${i.quantity}`;
    }).join(", ");
  }
}

(async () => {
  const orders = await Order.findAll();
  const svc = new ExportService();
  
  console.log('--- Checking exported products ---');
  for (const order of orders) {
    let items = [];
    try {
      items = typeof order.line_items === 'string' ? JSON.parse(order.line_items) : order.line_items;
    } catch (e) {
      console.log(`Order ${order.order_number}: Failed to parse JSON: ${order.line_items}`);
      continue;
    }
    const formatted = svc._formatProductsForExport(items);
    console.log(`Order ${order.order_number}: ${formatted}`);
  }
  await sequelize.close();
})();
