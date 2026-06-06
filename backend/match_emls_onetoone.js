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
  // Clear previous screenshot paths so we start fresh and do a clean one-to-one match
  await sequelize.query("UPDATE orders SET email_screenshot_path = NULL, attachment_paths = '[]'");
  console.log("Cleared existing email_screenshot_path and attachment_paths in DB.");

  const orders = await Order.findAll();
  console.log(`Loaded ${orders.length} orders from database.`);
  
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir);
  const emlFiles = files.filter(f => f.endsWith('.eml'));
  console.log(`Found ${emlFiles.length} EML files in uploads.`);
  
  // We will map EML files to subjects
  const emlMap = new Map();
  console.log("Parsing all EML files...");
  let parsedCount = 0;
  for (const emlFile of emlFiles) {
    const emlPath = path.join(uploadsDir, emlFile);
    try {
      const emailBuffer = fs.readFileSync(emlPath);
      const parsed = await simpleParser(emailBuffer);
      const subject = parsed.subject || "";
      const date = parsed.date || new Date();
      const cleanSub = cleanSubject(subject);
      
      if (!emlMap.has(cleanSub)) {
        emlMap.set(cleanSub, []);
      }
      emlMap.get(cleanSub).push({
        file: emlFile,
        path: emlPath,
        parsed,
        date: new Date(date)
      });
      parsedCount++;
      if (parsedCount % 100 === 0) {
        console.log(`Parsed ${parsedCount} / ${emlFiles.length} EML files.`);
      }
    } catch (e) {
      // ignore
    }
  }
  
  console.log("Finished parsing EML files. Matching with orders...");
  let matchCount = 0;
  
  for (const order of orders) {
    const cleanSub = cleanSubject(order.email_subject);
    const orderDate = new Date(order.email_date);
    
    const candidates = emlMap.get(cleanSub);
    if (candidates && candidates.length > 0) {
      // Find the candidate with the closest date
      let bestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const diff = Math.abs(candidates[i].date.getTime() - orderDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
      
      // Select the best candidate and remove it from the map so it is not reused (one-to-one)
      const bestCandidate = candidates.splice(bestIdx, 1)[0];
      
      const relativeEmlPath = `uploads/${bestCandidate.file}`;
      order.email_screenshot_path = relativeEmlPath;
      
      // Process attachments in EML and link them
      const attachments = bestCandidate.parsed.attachments || [];
      const attPaths = [];
      
      for (const att of attachments) {
        const ext = path.extname(att.filename || "").toLowerCase();
        const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
        if (!validExts.includes(ext)) continue;
        
        // Save attachment to file
        const attId = require('uuid').v4();
        const attPath = path.join(uploadsDir, `${attId}${ext}`);
        fs.writeFileSync(attPath, att.content);
        
        await EmailAttachment.create({
          id: attId,
          order_id: order.id,
          filename: att.filename,
          file_path: attPath,
          content_type: att.contentType
        });
        
        attPaths.push(attPath);
        console.log(`Order ${order.id}: Linked attachment ${att.filename} -> ${attPath}`);
      }
      
      order.attachment_paths = attPaths;
      await order.save();
      
      console.log(`Matched Order ${order.id} with EML ${bestCandidate.file} (diff: ${(minDiff/1000).toFixed(1)}s)`);
      matchCount++;
    } else {
      console.log(`No remaining EML candidate for order ${order.id} (Subject: ${order.email_subject})`);
    }
  }
  
  console.log(`\nMatched and linked ${matchCount} / ${orders.length} orders.`);
  await sequelize.close();
}

run().catch(console.error);
