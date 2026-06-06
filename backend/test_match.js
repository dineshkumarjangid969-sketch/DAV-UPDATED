const { STORE_REGISTRY } = require('./server.js');

const storeAliasMap = {};
for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
  storeAliasMap[storeName.toLowerCase()] = storeName;
  if (data.aliases) {
    for (const alias of data.aliases) {
      storeAliasMap[alias.toLowerCase()] = storeName;
    }
  }
}

function matchStore(text) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const keys = Object.keys(storeAliasMap).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (t.includes(k)) {
      return storeAliasMap[k];
    }
  }
  return null;
}

console.log("Domain Match:", matchStore("nz.harveynorman.com"));
console.log("Email Match:", matchStore("Singh, Ninder <Ninder.Singh@nz.harveynorman.com>"));
