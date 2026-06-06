const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { simpleParser } = require('mailparser');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

const Order = sequelize.define("Order", {
  id: { type: Sequelize.STRING(50), primaryKey: true },
  email_subject: Sequelize.STRING(255),
  email_from: Sequelize.STRING(255),
  email_date: Sequelize.DATE,
  email_screenshot_path: Sequelize.STRING(255),
  attachment_paths: { type: Sequelize.JSON, defaultValue: [] },
  raw_email_body: Sequelize.TEXT,
  normalized_data: { type: Sequelize.JSON, defaultValue: {} },
}, { tableName: 'orders', timestamps: true });

const EmailAttachment = sequelize.define("EmailAttachment", {
  id: { type: Sequelize.STRING(50), primaryKey: true },
  order_id: Sequelize.STRING(50),
  filename: Sequelize.STRING(255),
  file_path: Sequelize.STRING(255),
  content_type: Sequelize.STRING(50),
}, { tableName: 'email_attachments', timestamps: true });

function cleanSubject(sub) {
  if (!sub) return "";
  return sub.replace(/^(fwd|fw|re|reply|read|scan):\s*/i, "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function run() {
  const orders = await Order.findAll();
  console.log(`Loaded ${orders.length} orders from database.`);
  
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir);
  const emlFiles = files.filter(f => f.endsWith('.eml'));
  console.log(`Found ${emlFiles.length} EML files in uploads.`);
  
  let matchCount = 0;
  for (const emlFile of emlFiles) {
    const emlPath = path.join(uploadsDir, emlFile);
    try {
      const emailBuffer = fs.readFileSync(emlPath);
      const parsed = await simpleParser(emailBuffer);
      const subject = parsed.subject || "";
      const fromText = parsed.from?.text || "";
      
      const cleanSub = cleanSubject(subject);
      
      // Try to find a matching order
      let bestOrder = null;
      for (const order of orders) {
        if (cleanSubject(order.email_subject) === cleanSub) {
          bestOrder = order;
          break;
        }
      }
      
      if (bestOrder) {
        console.log(`\nMatch found!`);
        console.log(`EML: ${emlFile} | Subject: ${subject}`);
        console.log(`Order ID: ${bestOrder.id} | Subject: ${bestOrder.email_subject}`);
        
        // Link EML
        const relativeEmlPath = `uploads/${emlFile}`;
        if (bestOrder.email_screenshot_path !== relativeEmlPath) {
          bestOrder.email_screenshot_path = relativeEmlPath;
          await bestOrder.save();
          console.log(`Linked EML path to order ${bestOrder.id}`);
        }
        
        // Process attachments in EML and link them
        const attachments = parsed.attachments || [];
        
        let attPaths = bestOrder.attachment_paths;
        if (typeof attPaths === 'string') {
          try {
            attPaths = JSON.parse(attPaths);
          } catch (e) {
            attPaths = [];
          }
        }
        if (!Array.isArray(attPaths)) {
          attPaths = [];
        }
        
        let updatedAtts = false;
        
        for (const att of attachments) {
          const ext = path.extname(att.filename || "").toLowerCase();
          const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
          if (!validExts.includes(ext)) continue;
          
          // Check if we already have an attachment for this order with this filename
          const existingAtt = await EmailAttachment.findOne({
            where: {
              order_id: bestOrder.id,
              filename: att.filename
            }
          });
          
          if (!existingAtt) {
            // Save attachment to file
            const attId = require('uuid').v4();
            const attPath = path.join(uploadsDir, `${attId}${ext}`);
            fs.writeFileSync(attPath, att.content);
            
            await EmailAttachment.create({
              id: attId,
              order_id: bestOrder.id,
              filename: att.filename,
              file_path: attPath,
              content_type: att.contentType
            });
            
            attPaths.push(attPath);
            updatedAtts = true;
            console.log(`Created & linked attachment: ${att.filename} -> ${attPath}`);
          }
        }
        
        if (updatedAtts) {
          bestOrder.attachment_paths = attPaths;
          await bestOrder.save();
        }
        
        matchCount++;
      }
    } catch (e) {
      console.error(`Error parsing ${emlFile}:`, e.message);
    }
  }
  
  console.log(`\nMatched and linked ${matchCount} / ${emlFiles.length} EML files.`);
  await sequelize.close();
}

run().catch(console.error);
