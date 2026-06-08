const { Sequelize } = require('sequelize');
const seq = new Sequelize({dialect:'sqlite', storage:'dav_transport.db', logging:false});

(async () => {
  // Get the full raw email body for order 228650
  const [order] = await seq.query("SELECT raw_email_body FROM Orders WHERE id = '228650'");
  if (order.length > 0) {
    console.log("=== FULL RAW EMAIL BODY ===");
    console.log(order[0].raw_email_body);
  }
  
  // Check the email_attachments for this order
  const [atts] = await seq.query("SELECT id, order_id, filename, file_path FROM email_attachments WHERE order_id = '228650'");
  console.log(`\n=== email_attachments rows for order 228650: ${atts.length} ===`);
  atts.forEach((a, i) => console.log(`  [${i}] id=${a.id}, filename=${a.filename}, path=${a.file_path}`));
  
  await seq.close();
})();
