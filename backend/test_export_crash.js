const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'dav_transport.db', logging: false });

const Order = sequelize.define("Order", {
  id: { type: Sequelize.STRING(50), primaryKey: true },
  order_number: { type: Sequelize.STRING(50), allowNull: false },
  invoice_number: Sequelize.STRING(50),
  email_subject: Sequelize.STRING,
  email_date: Sequelize.DATE,
  type: Sequelize.STRING(30),
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
  normalized_data: Sequelize.JSON,
});

// Mock dependencies required by server.js ExportService
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");

class ExportService {
  _getBtRouteType(order) {
    try {
      const nd = typeof order.normalized_data === "string"
        ? JSON.parse(order.normalized_data || "{}")
        : (order.normalized_data || {});
      return nd.btOrderType || "";
    } catch { return ""; }
  }

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

  async exportToPDF(orders, filePath) {
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
    const colWidths = [45, 45, 55, 45, 100, 20, 45, 50, 48, 48, 45, 30, 30, 30, 33, 62];
    let x = 30;
    headers.forEach((h, i) => {
      doc.fontSize(8).text(h, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });
    y += 15;
    doc.moveTo(30, y).lineTo(811.89, y).stroke();
    y += 5;

    for (const order of orders) {
      const items = typeof order.line_items === "string"
        ? JSON.parse(order.line_items || "[]")
        : (order.line_items || []);
      const formattedProducts = this._formatProductsForExport(items);
      const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const btRouteType = this._getBtRouteType(order);

      const values = [
        order.order_number || "",
        order.invoice_number || "",
        order.email_subject || "",
        order.email_date ? new Date(order.email_date).toLocaleDateString("en-GB") : "",
        formattedProducts,
        totalQty > 0 ? String(totalQty) : "",
        order.bt_type === "branch_transfer" ? "Branch Xfer" : (order.bt_type || "").replace(/_/g, " "),
        btRouteType,
        order.bt_from || "",
        order.bt_to || "",
        order.billing_party || "",
        order.picked_up ? "Yes" : "No",
        order.delivered ? "Yes" : "No",
        order.billed ? "Yes" : "No",
        order.rate ? `$${order.rate.toFixed(2)}` : "—",
        order.location || "",
      ];

      doc.fontSize(7);
      let rowHeight = 12;
      values.forEach((v, i) => {
        const h = doc.heightOfString(String(v), { width: colWidths[i] });
        if (h > rowHeight) rowHeight = h;
      });

      if (y + rowHeight > 520) { doc.addPage(); y = 30; doc.fontSize(7); }
      
      x = 30;
      values.forEach((v, i) => {
        doc.text(String(v), x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += rowHeight + 4;
    }

    doc.end();
    return new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  }
}

(async () => {
  try {
    const orders = await Order.findAll();
    console.log(`Fetched ${orders.length} orders`);
    const exportService = new ExportService();
    await exportService.exportToPDF(orders, "test_export_real.pdf");
    console.log("PDF Export complete");
  } catch(e) {
    console.error("ERROR:", e);
  } finally {
    await sequelize.close();
  }
})();
