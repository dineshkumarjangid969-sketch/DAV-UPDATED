const { Sequelize, Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const PDFDocument = require("pdfkit");
const geolib = require("geolib");

const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'dav_transport.db', logging: false });

const Order = sequelize.define("Order", {
  id: { type: Sequelize.STRING(50), primaryKey: true },
  order_number: { type: Sequelize.STRING(50), allowNull: false },
  invoice_number: Sequelize.STRING(50),
  email_subject: Sequelize.STRING,
  email_date: Sequelize.DATE,
  bt_type: Sequelize.STRING(30),
  bt_from: Sequelize.STRING(100),
  bt_to: Sequelize.STRING(100),
  billing_party: Sequelize.STRING,
  picked_up: Sequelize.BOOLEAN,
  delivered: Sequelize.BOOLEAN,
  billed: Sequelize.BOOLEAN,
  rate: Sequelize.FLOAT,
  location: Sequelize.STRING,
  line_items: Sequelize.TEXT,
  normalized_data: Sequelize.TEXT,
});

class ExportService {
  _getBtRouteType(order) {
    try {
      const nd = typeof order.normalized_data === "string"
        ? JSON.parse(order.normalized_data || "{}")
        : (order.normalized_data || {});
      return nd.btOrderType || "";
    } catch { return ""; }
  }

  async exportToPDF(orders, filePath) {
    try {
      const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(18).text("DAV Transport - Orders Report", 30, 30);
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 30, 55);
      doc.moveTo(30, 70).lineTo(811.89, 70).stroke();

      let y = 85;
      const headers = [
        "Order #", "Invoice #", "Subject", "Email Date", "Products", "Qty",
        "BT Type", "BT Route", "BT From", "BT To", "Billing", "Picked",
        "Deliv", "Billed", "Rate", "Location"
      ];
      const colWidths = [48, 45, 60, 52, 60, 25, 48, 52, 50, 50, 48, 30, 30, 30, 33, 70];
      let x = 30;
      headers.forEach((h, i) => {
        doc.fontSize(8).text(h, x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += 15;
      doc.moveTo(30, y).lineTo(811.89, y).stroke();
      y += 5;

      for (const order of orders) {
        if (y > 520) { doc.addPage(); y = 30; }
        x = 30;
        
        const items = typeof order.line_items === "string"
          ? JSON.parse(order.line_items || "[]")
          : (order.line_items || []);
        const formattedProducts = items
          .map(i => `${i.sku} x${i.quantity}`)
          .join(", ");
        const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const btRouteType = this._getBtRouteType(order);

        const values = [
          order.order_number || "",
          order.invoice_number || "",
          (order.email_subject || "").substring(0, 14),
          order.email_date ? new Date(order.email_date).toLocaleDateString("en-GB") : "",
          formattedProducts.substring(0, 14),
          totalQty > 0 ? String(totalQty) : "",
          order.bt_type === "branch_transfer" ? "Branch Xfer" : (order.bt_type || "").replace(/_/g, " "),
          btRouteType,
          (order.bt_from || "").substring(0, 11),
          (order.bt_to || "").substring(0, 11),
          (order.billing_party || "").substring(0, 10),
          order.picked_up ? "Yes" : "No",
          order.delivered ? "Yes" : "No",
          order.billed ? "Yes" : "No",
          order.rate ? `$${order.rate.toFixed(2)}` : "—",
          (order.location || "").substring(0, 16),
        ];

        values.forEach((v, i) => {
          doc.fontSize(7).text(String(v), x, y, { width: colWidths[i], align: "left" });
          x += colWidths[i];
        });
        y += 12;
      }

      doc.end();
      return new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
    } catch (err) {
      console.error("SYNC ERROR:", err);
    }
  }
}

(async () => {
  const orders = await Order.findAll({ limit: 500 });
  console.log(`Fetched ${orders.length} orders`);
  const exportService = new ExportService();
  await exportService.exportToPDF(orders, "test_export.pdf");
  console.log("Export complete");
  await sequelize.close();
})();
