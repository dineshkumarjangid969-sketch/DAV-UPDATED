const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const buildDir = path.join(__dirname, 'build');

app.use(express.static(buildDir));
app.get('*', (req, res) => res.sendFile(path.join(buildDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`Frontend production server running on http://localhost:${PORT}`);
});
