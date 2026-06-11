const { Sequelize } = require("sequelize");
const path = require("path");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "dav_transport.db"),
  logging: console.log,
});

async function run() {
  try {
    const [results, metadata] = await sequelize.query("DELETE FROM orders WHERE order_number LIKE 'BT_%'");
    console.log(`Deleted BT_ junk orders. Results:`, metadata);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sequelize.close();
  }
}

run();
