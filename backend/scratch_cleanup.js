const { Sequelize } = require('sequelize');
const seq = new Sequelize({dialect:'sqlite', storage:'dav_transport.db', logging:false});

(async () => {
  // 1. Delete duplicate EmailAttachments (keep latest)
  const [dupes] = await seq.query(`
    SELECT filename, COUNT(*) as cnt 
    FROM email_attachments 
    GROUP BY filename 
    HAVING cnt > 1
  `);
  
  let deletedCount = 0;
  for (const d of dupes) {
    const [rows] = await seq.query(`SELECT id, file_path FROM email_attachments WHERE filename = ? ORDER BY createdAt DESC`, { replacements: [d.filename] });
    
    // Keep first (newest), delete rest
    for (let i = 1; i < rows.length; i++) {
      await seq.query(`DELETE FROM email_attachments WHERE id = ?`, { replacements: [rows[i].id] });
      deletedCount++;
    }
  }
  console.log(`Deleted ${deletedCount} duplicate attachments from database.`);

  // 2. Reprocess Order 228650
  // Note: we can test extraction by directly calling the parsing functions if we had them exported,
  // but instead we'll just invoke `node server.js` which has the `/api/system/reprocess` endpoint.
  
  await seq.close();
})();
