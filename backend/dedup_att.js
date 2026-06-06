const { Sequelize } = require('sequelize');
const fs = require('fs');
const sq = new Sequelize({ dialect: 'sqlite', storage: './dav_transport.db', logging: false });

(async () => {
  const [rows] = await sq.query(`
    SELECT order_id, filename, COUNT(*) as c, GROUP_CONCAT(id) as ids, GROUP_CONCAT(file_path) as paths
    FROM email_attachments 
    WHERE order_id IS NOT NULL AND filename IS NOT NULL
    GROUP BY order_id, filename 
    HAVING c > 1
  `);
  
  console.log(`Found ${rows.length} groups of duplicate attachments.`);
  let deletedCount = 0;

  for (const row of rows) {
    const ids = row.ids.split(',');
    const paths = row.paths.split(',');
    
    // Keep the first one
    const keepId = ids[0];
    const deleteIds = ids.slice(1);
    const deletePaths = paths.slice(1);
    
    if (deleteIds.length > 0) {
      console.log(`Keeping 1 attachment, deleting ${deleteIds.length} duplicates of ${row.filename} for order ${row.order_id}`);
      
      const inClause = deleteIds.map(id => `'${id}'`).join(',');
      await sq.query(`DELETE FROM email_attachments WHERE id IN (${inClause})`);
      deletedCount += deleteIds.length;
      
      // Delete the duplicate files from disk
      for (const p of deletePaths) {
        if (p && fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch(e) {}
        }
      }
    }
  }

  console.log(`Deleted a total of ${deletedCount} duplicate attachment rows and their files.`);
  process.exit(0);
})();
