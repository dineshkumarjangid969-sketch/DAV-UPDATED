const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: console.log
});

async function runCleanup() {
  try {
    console.log("Starting cleanup...");
    
    // 1. Delete all non-Branch Transfer orders
    const [deletedOrders] = await sequelize.query(`
      DELETE FROM orders WHERE type = 'customer_delivery';
    `);
    console.log("Deleted customer delivery orders.");

    // 2. Delete duplicate attachments per order based on filename
    // Keep the one with the lexicographically smallest UUID
    const [deletedAttachments] = await sequelize.query(`
      DELETE FROM email_attachments 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM email_attachments 
        GROUP BY order_id, filename
      );
    `);
    console.log("Deleted duplicate attachments from database.");

    // 3. Delete attachments where the order no longer exists
    const [orphanedAtts] = await sequelize.query(`
      DELETE FROM email_attachments
      WHERE order_id NOT IN (SELECT id FROM orders);
    `);
    console.log("Deleted orphaned attachments.");

    console.log("Cleanup complete!");
  } catch (err) {
    console.error("Error during cleanup:", err);
  } finally {
    await sequelize.close();
  }
}

runCleanup();
