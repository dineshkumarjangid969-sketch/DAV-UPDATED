const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

async function run() {
  const id = process.argv[2] || 'HN-1003';
  const [results] = await sequelize.query(`
    SELECT * FROM orders WHERE id = ?
  `, { replacements: [id] });

  if (results.length === 0) {
    console.log(`No order found with ID: ${id}`);
  } else {
    console.log(JSON.stringify(results[0], null, 2));
  }
  await sequelize.close();
}

run().catch(console.error);
