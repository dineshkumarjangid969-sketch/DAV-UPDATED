const http = require('http');

http.get('http://localhost:5000/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    console.log('BODY:', data);
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('ERROR connecting to backend health endpoint:', err.message);
  process.exit(1);
});
