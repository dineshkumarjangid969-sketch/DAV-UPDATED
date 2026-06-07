const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { normalizeOrderExtraction, STORE_REGISTRY } = require("./server.js");

const dbPath = path.join(__dirname, "dav_transport.db");
const db = new sqlite3.Database(dbPath);

async function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function testExtractions() {
  // Get first 5 orders to test extraction
  const orders = await runQuery("SELECT * FROM Orders LIMIT 5");
  
  console.log(`Testing extraction on ${orders.length} orders...\n`);
  
  for (const order of orders) {
    const normalized = normalizeOrderExtraction(
      order.email_subject || "",
      order.email_from || "",
      order.raw_email_body || "",
      "",
      []
    );
    
    console.log(`Order: ${order.order_number}`);
    console.log(`  Email Subject: ${order.email_subject}`);
    console.log(`  Current Invoice: ${order.invoice_number}`);
    console.log(`  Extracted Invoice: ${normalized.invoiceNo}`);
    console.log(`  Current Order: ${order.order_number}`);
    console.log(`  Extracted Order: ${normalized.orderNo}`);
    console.log(`  Current From: ${order.bt_from || order.pickup_store}`);
    console.log(`  Extracted From: ${normalized.comingFrom}`);
    console.log(`  Current To: ${order.bt_to || order.destination_store}`);
    console.log(`  Extracted To: ${normalized.destination}`);
    console.log(`  Type: ${normalized.type}`);
    console.log(`  BT Type: ${normalized.btType}`);
    console.log(`  Products: ${normalized.products.length}`);
    console.log("");
  }
  
  db.close();
}

testExtractions().catch(console.error);
