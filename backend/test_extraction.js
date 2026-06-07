const { normalizeOrderExtraction } = require('./server.js');
const fs = require('fs');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dav_transport.db',
  logging: false
});

(async () => {
  const [results] = await sequelize.query(`SELECT email_subject, raw_email_body FROM orders WHERE order_number="228650"`);
  if(results.length > 0) {
    const order = results[0];
    const normalized = normalizeOrderExtraction(order.email_subject, order.email_from, order.raw_email_body, "", []);
    console.log("EXTRACTED PRODUCTS:", JSON.stringify(normalized.products, null, 2));
  }
  process.exit(0);
})();
