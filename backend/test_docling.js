const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const DOCLING_URL = 'http://localhost:8000';

async function testDocling(filePath) {
  console.log(`\nTesting Docling on: ${filePath}`);
  console.log(`File exists: ${fs.existsSync(filePath)}`);
  console.log(`File size: ${fs.statSync(filePath).size} bytes`);
  
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    const response = await axios.post(`${DOCLING_URL}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: 50 * 1024 * 1024
    });
    
    const data = response.data;
    console.log('\n=== Docling Response Keys ===');
    console.log(Object.keys(data));
    
    if (data.raw_markdown) {
      console.log('\n=== Raw Markdown (first 2000 chars) ===');
      console.log(data.raw_markdown.substring(0, 2000));
    }
    
    if (data.raw_tables && data.raw_tables.length > 0) {
      console.log('\n=== Raw Tables ===');
      for (let i = 0; i < Math.min(data.raw_tables.length, 3); i++) {
        console.log(`\nTable ${i}:`);
        const table = data.raw_tables[i];
        for (let r = 0; r < Math.min(table.length, 5); r++) {
          console.log(`  Row ${r}: ${JSON.stringify(table[r])}`);
        }
      }
    } else {
      console.log('\nNo raw_tables returned.');
    }
    
    return data;
  } catch (err) {
    console.error('Docling error:', err.message);
    return null;
  }
}

(async () => {
  // Test with a few PDFs from orders with empty products
  const testFiles = [
    'C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\06c0c3f1-73fa-447b-9d85-3e3deb18ff39.pdf',  // NZ-022-3831432
    'C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\6cffb086-5567-40bf-8061-9016e0d7d764.pdf',  // 3831158
    'C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\0e81cd89-affb-4562-8704-ce90225bcd47.pdf',  // Box order
  ];
  
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      await testDocling(file);
    } else {
      console.log(`\nSkipping ${file} - not found`);
    }
  }
  
  process.exit(0);
})();
