const { Sequelize } = require('sequelize');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  const [rows] = await sq.query(`
    SELECT invoice_number, email_subject, COUNT(*) as c, GROUP_CONCAT(id) as ids 
    FROM orders 
    WHERE invoice_number IS NOT NULL AND invoice_number != '' AND invoice_number != 'Not identified'
    GROUP BY invoice_number, email_subject 
    HAVING c > 1
  `);
  
  console.log(`Found ${rows.length} groups of duplicates.`);
  let deletedCount = 0;

  for (const row of rows) {
    const ids = row.ids.split(',');
    
    // Prefer to keep an ID that DOES NOT start with BT_
    // If all start with BT_, keep the first one
    let keepId = ids.find(id => !id.startsWith('BT_')) || ids[0];
    const deleteIds = ids.filter(id => id !== keepId);
    
    if (deleteIds.length > 0) {
      console.log(`Keeping ${keepId}, deleting ${deleteIds.length} duplicates for invoice ${row.invoice_number}`);
      
      const inClause = deleteIds.map(id => `'${id}'`).join(',');
      await sq.query(`DELETE FROM orders WHERE id IN (${inClause})`);
      await sq.query(`DELETE FROM email_attachments WHERE order_id IN (${inClause})`);
      deletedCount += deleteIds.length;
    }
  }

  console.log(`Deleted a total of ${deletedCount} duplicate rows.`);
  process.exit(0);
})();
