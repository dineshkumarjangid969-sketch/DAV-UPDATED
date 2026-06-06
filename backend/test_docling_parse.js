const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const DOCLING_URL = "http://localhost:8000";

async function run() {
  const filePath = path.join(__dirname, 'uploads', '3aa43491-4ff1-43c6-9d96-c95a90841157.pdf');
  const filename = 'INV BL QUN FIRM.pdf';
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`Sending ${filename} to Docling at ${DOCLING_URL}...`);
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename });
    const response = await axios.post(`${DOCLING_URL}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    console.log("Response status:", response.status);
    console.log("Raw Markdown:\n", response.data.raw_markdown);
    console.log("\nRaw Tables:\n", JSON.stringify(response.data.raw_tables, null, 2));
  } catch (e) {
    console.error("Docling error:", e.message);
  }
}

run();
