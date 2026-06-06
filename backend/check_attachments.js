const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });
const fs = require('fs');
const path = require('path');

(async () => {
  // List all tables
  const [tables] = await sq.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('=== Tables ===');
  tables.forEach(t => console.log(' ', t.name));
  
  // Check attachment_paths column in orders with empty products
  const [rows] = await sq.query(`
    SELECT id, order_number, attachment_paths, normalized_data
    FROM Orders 
    WHERE (line_items IS NULL OR line_items = '' OR line_items = '[]' OR line_items = 'Not identified')
    AND attachment_paths IS NOT NULL AND attachment_paths != '' AND attachment_paths != '[]'
    LIMIT 10
  `);
  
  console.log('\n=== Orders with empty products but HAVE attachments ===');
  console.log('Count:', rows.length);
  
  for (const row of rows) {
    console.log(`\n  Order ${row.id} (${row.order_number}):`);
    console.log(`  attachment_paths: ${row.attachment_paths}`);
    
    // Check if attachment files exist
    try {
      const paths = JSON.parse(row.attachment_paths);
      for (const p of paths) {
        const fullPath = path.resolve(__dirname, p);
        const exists = fs.existsSync(fullPath);
        console.log(`    ${p} => exists: ${exists}`);
      }
    } catch(e) {
      console.log(`    (not JSON: ${row.attachment_paths})`);
    }
    
    // Check normalized_data for docling text
    try {
      const nd = JSON.parse(row.normalized_data || '{}');
      if (nd.doclingText) {
        console.log(`  doclingText (first 800): ${nd.doclingText.substring(0, 800)}`);
      } else {
        console.log('  doclingText: NONE');
      }
    } catch(e) {}
  }
  
  // Also count orders with no attachments AND empty products
  const [[noAttNoProduct]] = await sq.query(`
    SELECT count(*) as c FROM Orders 
    WHERE (line_items IS NULL OR line_items = '' OR line_items = '[]' OR line_items = 'Not identified')
    AND (attachment_paths IS NULL OR attachment_paths = '' OR attachment_paths = '[]')
  `);
  
  const [[hasAttNoProduct]] = await sq.query(`
    SELECT count(*) as c FROM Orders 
    WHERE (line_items IS NULL OR line_items = '' OR line_items = '[]' OR line_items = 'Not identified')
    AND attachment_paths IS NOT NULL AND attachment_paths != '' AND attachment_paths != '[]'
  `);
  
  console.log('\n=== Summary ===');
  console.log('Orders with empty products AND no attachments:', noAttNoProduct.c);
  console.log('Orders with empty products but HAVE attachments:', hasAttNoProduct.c);
  
  process.exit(0);
})();
