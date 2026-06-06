const { normalizeOrderExtraction } = require('./server.js');
const cache = require('./docling_cache.json');
const key = Object.keys(cache).find(k => k.includes('341874'));
const result = normalizeOrderExtraction('subject', 'from', 'body', '', [cache[key]]);
console.log(JSON.stringify(result, null, 2));
