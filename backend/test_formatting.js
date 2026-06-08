const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'dav_transport.db', logging: false });

const Order = sequelize.define("Order", {
  id: { type: Sequelize.STRING(50), primaryKey: true },
  order_number: { type: Sequelize.STRING(50), allowNull: false },
  invoice_number: Sequelize.STRING(50),
  line_items: Sequelize.TEXT,
});

function formatProductsForExport(items) {
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

(async () => {
  const orders = await Order.findAll({
    where: {
      order_number: { [Op.in]: ['123710', '228468', '205591'] }
    }
  });

  for (const order of orders) {
    const items = JSON.parse(order.line_items || "[]");
    console.log(`Order: ${order.order_number}`);
    console.log(`Original: ${items.map(i => i.description || i.sku).join(", ")}`);
    console.log(`Formatted: ${formatProductsForExport(items)}\n`);
  }
  
  await sequelize.close();
})();
