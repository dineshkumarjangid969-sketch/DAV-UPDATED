const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  // Check email_attachments table columns
  const [attCols] = await sq.query("PRAGMA table_info(email_attachments)");
  console.log('=== email_attachments columns ===');
  attCols.forEach(c => console.log(' ', c.name));

  // Count email_attachments  
  const [[attCount]] = await sq.query("SELECT count(*) as c FROM email_attachments");
  console.log('\nTotal email_attachments:', attCount.c);
  
  // Show samples
  const [attSamples] = await sq.query("SELECT * FROM email_attachments LIMIT 3");
  console.log('\n=== Sample email_attachments ===');
  for (const att of attSamples) {
    console.log(JSON.stringify(att, null, 2));
  }
  
  // Check how many orders with empty products have attachments in this table
  const [[hasAttInTable]] = await sq.query(`
    SELECT count(DISTINCT o.id) as c 
    FROM orders o 
    JOIN email_attachments ea ON ea.order_id = o.id
    WHERE (o.line_items IS NULL OR o.line_items = '' OR o.line_items = '[]' OR o.line_items = 'Not identified')
  `);
  console.log('\nOrders with empty products that have rows in email_attachments table:', hasAttInTable.c);
  
  // Now let's test Docling parsing on one attachment
  const [attForTest] = await sq.query(`
    SELECT ea.id, ea.order_id, ea.filename, ea.file_path, ea.content_type, ea.parsed_text
    FROM email_attachments ea 
    JOIN orders o ON ea.order_id = o.id
    WHERE (o.line_items IS NULL OR o.line_items = '' OR o.line_items = '[]')
    AND ea.file_path IS NOT NULL
    LIMIT 3
  `);
  
  console.log('\n=== Attachments for orders with empty products ===');
  for (const att of attForTest) {
    console.log(`Attachment ${att.id}: order=${att.order_id}, file=${att.filename}, path=${att.file_path}`);
    console.log(`  parsed_text: ${(att.parsed_text || 'NONE').substring(0,200)}`);
  }
  
  process.exit(0);
})();
