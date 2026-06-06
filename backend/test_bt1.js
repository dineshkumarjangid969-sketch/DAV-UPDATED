const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testDocling() {
  const filePath = path.resolve('../BT (1).pdf');
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  try {
    const res = await axios.post('http://localhost:8000/process-pdf', formData, {
      headers: formData.getHeaders()
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

testDocling();
