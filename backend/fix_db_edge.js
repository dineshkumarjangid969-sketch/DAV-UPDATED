const {Sequelize} = require('sequelize');
const path = require('path');
const sequelize = new Sequelize({dialect: 'sqlite', storage: path.join(__dirname, 'dav_transport.db'), logging: false});

sequelize.query('SELECT order_number, line_items FROM orders').then(async res => {
  const orders = res[0];
  let updated = 0;
  for (const order of orders) {
    let prods;
    try { prods = JSON.parse(order.line_items); } catch(e) { continue; }
    if(!prods || prods.length === 0) continue;
    
    const hasPrice = prods.some(p => p.description && /^[\$\d\.,\s]+$/.test(p.description));
    const hasDays = prods.some(p => p.description && /days a week/i.test(p.description));
    const hasInstructions = prods.some(p => p.description && /Deliver Not Before|THE INCREDI-BED DBL BASE/i.test(p.description));
    const hasOrd = prods.some(p => p.description && /ORD:\s*\d+/i.test(p.description));
    
    if(hasPrice || hasDays || hasInstructions || hasOrd) {
      console.log('Clearing', order.order_number, prods);
      await sequelize.query(`UPDATE orders SET line_items = '[]' WHERE order_number = '${order.order_number}'`);
      updated++;
    }
  }
  console.log('Updated:', updated);
  process.exit(0);
});
