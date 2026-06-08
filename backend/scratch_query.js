const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

async function run() {
  const [cols] = await sequelize.query("PRAGMA table_info(orders);");
  console.log(cols.map(c => c.name));
  await sequelize.close();
}
run();
