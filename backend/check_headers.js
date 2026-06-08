const http = require('http');

http.get('http://localhost:5000/api/dashboard/export/pdf', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});
