const { Sequelize, DataTypes, Op } = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

const Order = sequelize.define('Order', {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  email_subject: { type: DataTypes.STRING },
  raw_email_body: { type: DataTypes.TEXT }
}, { tableName: 'orders', timestamps: true });

(async () => {
  try {
    const o = await Order.findOne({ where: { email_subject: { [Op.like]: '%Urgent BT from%' } } });
    if (o) {
      console.log("Subject:", o.email_subject);
      const combinedContent = o.email_subject + " " + o.raw_email_body;
      
      const serverCode = fs.readFileSync('server.js', 'utf8');
      const invoiceNoMatch = serverCode.match(/function extractInvoiceNo\([\s\S]*?^}/m);
      if (invoiceNoMatch) {
         // evaluate extractInvoiceNo in this context
         const fnSource = invoiceNoMatch[0];
         const extractInvoiceNo = new Function('combinedContent', 
           fnSource.replace(/function extractInvoiceNo\([\s\S]*?{/, '')
           .replace(/}$/, '')
         );
         
         const blacklistStr = serverCode.match(/const blacklist = (\/.*\/[a-z]*);/);
         // The extracted function doesn't have the global context, so let's just do it directly.
      }
      
      // Let's just print the combined content snippet around 'box' or something to see why it matched!
      console.log("Raw body snippet:", o.raw_email_body.substring(0, 500));
      
      const match1 = combinedContent.match(/from\s+([A-Za-z]+)/i);
      console.log("from match:", match1 ? match1[1] : null);
      
      const match2 = combinedContent.match(/\b(?:INV|INVOICE|PO|SO|Order|Ref|Transaction)\b(?:\s+(?:reprint|copy|duplicate|original|status|date|no|number|tax|invoice|report|purchase|sales|re-print))*[:\s#\-_]+([A-Z0-9\-_\/]+)/gi);
      console.log("Invoice pattern match:", match2);

      const m3 = combinedContent.match(/box/i);
      if (m3) {
         console.log("Found 'box' at index", m3.index);
         console.log(combinedContent.substring(Math.max(0, m3.index-50), m3.index+50));
      }

    } else {
      console.log("Order not found in DB");
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
