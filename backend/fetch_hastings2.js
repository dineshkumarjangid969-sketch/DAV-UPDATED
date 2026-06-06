const { Order } = require('./database.js');
const { normalizeOrderExtraction } = require('./server.js');

(async () => {
  const orders = await Order.findAll();
  for (const o of orders) {
    if (o.source_email_subject && o.source_email_subject.includes('Hastings')) {
      const doclings = o.docling_data ? JSON.parse(o.docling_data) : [];
      const res = normalizeOrderExtraction(o.source_email_subject, "unknown@email.com", o.source_email_body, o.raw_html, doclings);
      console.log('--- Hastings Order ---');
      console.log('DB comingFrom:', o.pickup_store);
      console.log('DB destination:', o.destination_store);
      console.log('New comingFrom:', res.comingFrom);
      console.log('New destination:', res.destination);
      console.log('Subject:', res.sourceEmailSubject);
      console.log('---');
    }
  }
})();
