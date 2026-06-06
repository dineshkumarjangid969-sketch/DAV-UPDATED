const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

async function run() {
  const cachePath = path.join(__dirname, 'docling_cache.json');
  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const key = "d8da9083-413e-45f9-909c-99b3940890c1.pdf";
    if (cache[key]) {
      console.log(`=== Found cache for ${key} ===`);
      console.log("Raw Markdown:\n", cache[key].raw_markdown);
      console.log("\nRaw Tables:\n", JSON.stringify(cache[key].raw_tables, null, 2));
    } else {
      console.log(`No cache found for ${key}`);
    }
  } else {
    console.log("Cache file not found");
  }
}

run().catch(console.error);
