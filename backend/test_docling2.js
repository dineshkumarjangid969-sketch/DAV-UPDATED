const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const DOCLING_URL = 'http://localhost:8000';

async function testDocling(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  const response = await axios.post(`${DOCLING_URL}/parse`, form, {
    headers: form.getHeaders(),
    timeout: 120000,
    maxContentLength: 50 * 1024 * 1024
  });
  
  const data = response.data;
  console.log(`\nFile: ${filePath}`);
  console.log('line_items:', JSON.stringify(data.line_items));
  console.log('order_number:', data.order_number);
  console.log('invoice_number:', data.invoice_number);
  console.log('po_number:', data.po_number);
  console.log('customer_name:', data.customer_name);
  console.log('pickup_store:', data.pickup_store);
  console.log('destination_store:', data.destination_store);
  
  return data;
}

(async () => {
  const testFiles = [
    'C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\06c0c3f1-73fa-447b-9d85-3e3deb18ff39.pdf',
    'C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\6cffb086-5567-40bf-8061-9016e0d7d764.pdf',
  ];
  
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      await testDocling(file);
    }
  }
  
  process.exit(0);
})();
