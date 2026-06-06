const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// Replace normalizeOrderExtraction
const normRegex = /function normalizeOrderExtraction\(subject, from, body, html, doclings\) \{[\s\S]*?\n\}\n\nfunction getNormalizedOrder/m;
const newNorm = `function normalizeOrderExtraction(subject, from, body, html, doclings) {
  const emailBodyText = (body || "") + "\\n" + htmlToText(html);
  
  let attachmentsText = "";
  let rawTables = [];
  let doclingLineItems = [];
  if (doclings && Array.isArray(doclings)) {
    for (const doc of doclings) {
      if (doc.raw_markdown) {
        attachmentsText += doc.raw_markdown + "\\n";
      }
      if (doc.raw_tables) {
        rawTables = rawTables.concat(doc.raw_tables);
      }
      if (doc.line_items && Array.isArray(doc.line_items) && doc.line_items.length > 0) {
        doclingLineItems = doclingLineItems.concat(doc.line_items);
      }
    }
  }
  
  // Combine only the current document's text and email body
  const combinedContent = [
    \`Subject: \${subject || ""}\`,
    \`From: \${from || ""}\`,
    \`Body: \${body || ""}\`,
    \`HTML: \${htmlToText(html)}\`,
    \`Attachments Text: \${attachmentsText}\`,
    \`Attachments Tables: \${formatDoclingTables(rawTables)}\`
  ].join("\\n");
  
  const invoiceNo = extractInvoiceNo(combinedContent);
  const route = extractRouteFromContent(subject, from, emailBodyText, attachmentsText);
  let comingFrom = route.comingFrom;
  let destination = route.destination;
  
  // Specific checks for Manukau -> Westgate based on invoice strings if regex misses
  if (attachmentsText.toLowerCase().includes("hn bedding manukau") && attachmentsText.toLowerCase().includes("westgate")) {
      if (!comingFrom || comingFrom === "Not identified") comingFrom = "Westgate";
      if (!destination || destination === "Not identified") destination = "Manukau";
  }
  
  const products = extractProducts(emailBodyText, rawTables, attachmentsText, doclingLineItems);
  const billTo = extractBillTo(combinedContent, destination);
  const deliveryStart = extractDeliveryStart(combinedContent);
  const deliveryStops = destination && destination !== "Not identified" ? [destination] : [];
  
  const normalized = {
    invoiceNo,
    comingFrom,
    destination,
    products,
    billTo,
    deliveryStart,
    deliveryStops,
    sourceEmailSubject: subject || "Not identified",
    sourceEmailBody: body || "Not identified",
    sourceAttachments: doclings ? doclings.map(d => d.filename || "Attachment") : []
  };
  
  return normalized;
}

function getNormalizedOrder`;

code = code.replace(normRegex, newNorm);

// Replace processMessage loop
const processRegex = /async processMessage\(rawEmail, account\) \{[\s\S]*?return orderJson;\n  \}/m;

const newProcess = `async processMessage(rawEmail, account) {
    const parsed = await simpleParser(rawEmail);
    const subject = parsed.subject || "";
    const from = parsed.from?.text || "";
    const date = parsed.date || new Date();
    const body = parsed.text || "";
    const html = parsed.html || "";

    if (!isOrderEmail(subject, body)) {
      console.log(\`[SKIP] Not an order email: "\${subject.substring(0, 70)}..."\`);
      return null;
    }

    const emlId = uuidv4();
    const emlPath = path.join(__dirname, "uploads", \`\${emlId}.eml\`);
    fs.writeFileSync(emlPath, rawEmail);

    const attachments = parsed.attachments || [];
    const docDataList = [];
    const attachmentPaths = [];

    for (const att of attachments) {
      const ext = path.extname(att.filename || "").toLowerCase();
      const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
      if (!validExts.includes(ext)) continue;

      const attId = uuidv4();
      const attPath = path.join(__dirname, "uploads", \`\${attId}\${ext}\`);
      fs.writeFileSync(attPath, att.content);
      attachmentPaths.push(attPath);

      if (ext === ".pdf") {
        const parsedDoc = await parseWithDocling(attPath, att.filename);
        if (parsedDoc) {
          parsedDoc.filename = att.filename;
          parsedDoc.attPath = attPath;
          docDataList.push(parsedDoc);
        }
      }
      
      await EmailAttachment.create({
        id: attId,
        filename: att.filename,
        file_path: attPath,
        content_type: att.contentType,
      });
    }

    let docsToProcess = docDataList.length > 0 ? docDataList : [null];
    let createdOrders = [];

    for (const doc of docsToProcess) {
      const normalized = normalizeOrderExtraction(subject, from, body, html, doc ? [doc] : []);

      const invoiceNumRaw = doc ? (doc.invoice_number || doc.order_number || normalized.invoiceNo) : normalized.invoiceNo;
      const orderNumRaw = doc ? (doc.order_number || doc.invoice_number || normalized.invoiceNo) : normalized.invoiceNo;

      const data = {
        order_number: orderNumRaw && orderNumRaw !== "Not identified" && orderNumRaw !== "" ? orderNumRaw : \`BT_\${uuidv4().substring(0,8)}\`,
        invoice_number: invoiceNumRaw && invoiceNumRaw !== "Not identified" ? invoiceNumRaw : "",
        email_subject: subject,
        email_from: from,
        email_date: date,
        raw_email_body: body,
        normalized_data: normalized,
        pickup_store: normalized.comingFrom !== "Not identified" ? normalized.comingFrom : "",
        destination_store: normalized.destination !== "Not identified" ? normalized.destination : "",
        destination_address: normalized.destination !== "Not identified" ? normalized.destination : "",
        billing_party: normalized.billTo !== "Not identified" ? normalized.billTo : "",
        location: normalized.destination !== "Not identified" ? normalized.destination : "",
        line_items: normalized.products,
        bt_from: normalized.comingFrom !== "Not identified" ? normalized.comingFrom : "",
        bt_to: normalized.destination !== "Not identified" ? normalized.destination : "",
      };

      const originStore = STORE_REGISTRY[data.pickup_store];
      if (originStore) {
        data.pickup_lat = originStore.lat;
        data.pickup_lon = originStore.lon;
      }
      const destStore = STORE_REGISTRY[data.destination_store];
      if (destStore) {
        data.dest_lat = destStore.lat;
        data.dest_lon = destStore.lon;
      } else {
        const storeName = matchStore(data.destination_address);
        if (storeName && STORE_REGISTRY[storeName]) {
          data.dest_lat = STORE_REGISTRY[storeName].lat;
          data.dest_lon = STORE_REGISTRY[storeName].lon;
        }
      }

      data.rate = 85.00;
      const bodyLower = (body + " " + html).toLowerCase();
      data.requires_assembly = bodyLower.includes("assemble") && !bodyLower.includes("customer to assemble");
      data.has_rubbish_removal = ["rubbish", "take away", "takeaway", "remove rubbish"].some(t => bodyLower.includes(t));

      const orderId = data.order_number;
      let order = await Order.findByPk(orderId);
      let isNew = false;
      if (order) {
        await order.update(data);
      } else {
        data.id = orderId;
        data.status = "pending";
        order = await Order.create(data);
        isNew = true;
      }

      for (const attPath of attachmentPaths) {
        const att = await EmailAttachment.findOne({ where: { file_path: attPath } });
        if (att) {
           if (doc && att.file_path === doc.attPath) {
             await att.update({ order_id: order.id });
           } else if (!doc || !attPath.endsWith('.pdf')) {
             await att.update({ order_id: order.id });
           }
        }
      }

      const orderJson = order.toJSON();
      orderJson._isNew = isNew;

      if (orderJson && orderJson._isNew) {
        sendEmailConfirmation(orderJson).catch(err => console.error("Auto-reply error:", err));
      }
      
      createdOrders.push(orderJson);
    }

    return createdOrders;
  }`;

code = code.replace(processRegex, newProcess);

// Replace fetch loop that calls processMessage to handle multiple return values
const fetchRegex = /const order = await this\.processMessage\(msg, account\);\n\s*if \(order\) \{\n\s*newOrders\.push\(order\);\n\s*\} else \{\n\s*skipped\+\+;\n\s*\}/m;

const newFetch = `const orders = await this.processMessage(msg, account);
          if (orders && Array.isArray(orders) && orders.length > 0) {
            newOrders.push(...orders);
          } else {
            skipped++;
          }`;

code = code.replace(fetchRegex, newFetch);

fs.writeFileSync('server.js', code);
console.log('Update completed');
