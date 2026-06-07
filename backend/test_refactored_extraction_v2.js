const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

const Order = sequelize.define("Order", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  email_subject: DataTypes.STRING(255),
  email_from: DataTypes.STRING(255),
  raw_email_body: DataTypes.TEXT,
  attachment_paths: DataTypes.JSON,
  normalized_data: DataTypes.JSON,
}, { tableName: "orders", timestamps: true });

const EmailAttachment = sequelize.define("EmailAttachment", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  order_id: DataTypes.STRING(50),
  filename: DataTypes.STRING(255),
  file_path: DataTypes.STRING(255),
}, { tableName: "email_attachments", timestamps: true });

const STORE_REGISTRY = {
  "Wairau Park": { region: "Auckland", aliases: ["wairau", "wairau park", "commercial wairau"] },
  "Albany": { region: "Auckland", aliases: ["albany"] },
  "Westgate": { region: "Auckland", aliases: ["westgate"] },
  "Lower Hutt": { region: "Wellington", aliases: ["lower hutt", "hutt"] },
  "Palmerston North": { region: "Manawatu", aliases: ["palmerston north", "palmy"] },
  "Hamilton": { region: "Waikato", aliases: ["hamilton"] },
  "Whanganui": { region: "Manawatu", aliases: ["whanganui", "wanganui"] },
  "Whakatane": { region: "Bay of Plenty", aliases: ["whakatane"] },
  "Whangarei": { region: "Northland", aliases: ["whangarei"] },
  "Hastings": { region: "Hawkes Bay", aliases: ["hastings", "akina"] },
  "Mt Wellington": { region: "Auckland", aliases: ["mt wellington", "mount wellington"] },
  "Manukau": { region: "Auckland", aliases: ["manukau"] },
  "Porirua": { region: "Wellington", aliases: ["porirua"] },
  "New Plymouth": { region: "Taranaki", aliases: ["new plymouth"] },
  "Pukekohe": { region: "Auckland", aliases: ["pukekohe"] },
  "Mt Maunganui": { region: "Bay of Plenty", aliases: ["mt maunganui", "mount maunganui"] },
  "Botany": { region: "Auckland", aliases: ["botany"] },
  "Rotorua": { region: "Bay of Plenty", aliases: ["rotorua"] },
  "Masterton": { region: "Wellington", aliases: ["masterton"] },
  "Mt Roskill": { region: "Auckland", aliases: ["mt roskill", "mount roskill"] },
  "Dargaville": { region: "Northland", aliases: ["dargaville"] },
  "Timaru": { region: "Canterbury", aliases: ["timaru"] },
  
  // The Warehouse stores
  "The Warehouse Wairau Park": { region: "Auckland", aliases: ["the warehouse wairau park", "warehouse wairau", "tw wairau"] },
  "The Warehouse Albany": { region: "Auckland", aliases: ["the warehouse albany", "warehouse albany", "tw albany"] },
  "The Warehouse Westgate": { region: "Auckland", aliases: ["the warehouse westgate", "warehouse westgate", "tw westgate"] },
  "The Warehouse Manukau": { region: "Auckland", aliases: ["the warehouse manukau", "warehouse manukau", "tw manukau"] },
  "The Warehouse Hamilton": { region: "Waikato", aliases: ["the warehouse hamilton", "warehouse hamilton", "tw hamilton"] },
  "The Warehouse Palmerston North": { region: "Manawatu", aliases: ["the warehouse palmerston north", "warehouse palmerston north", "warehouse palmy", "tw palmerston north", "tw palmy"] },
  "The Warehouse Whanganui": { region: "Manawatu", aliases: ["the warehouse whanganui", "warehouse whanganui", "warehouse wanganui", "tw whanganui", "tw wanganui"] },
  "The Warehouse Whakatane": { region: "Bay of Plenty", aliases: ["the warehouse whakatane", "warehouse whakatane", "tw whakatane"] },
  "The Warehouse Whangarei": { region: "Northland", aliases: ["the warehouse whangarei", "warehouse whangarei", "tw whangarei"] },
  "The Warehouse Hastings": { region: "Hawkes Bay", aliases: ["the warehouse hastings", "warehouse hastings", "tw hastings"] },
  "The Warehouse Lower Hutt": { region: "Wellington", aliases: ["the warehouse lower hutt", "warehouse lower hutt", "warehouse hutt", "tw lower hutt", "tw hutt"] },
  "The Warehouse Porirua": { region: "Wellington", aliases: ["the warehouse porirua", "warehouse porirua", "tw porirua"] },
  "The Warehouse New Plymouth": { region: "Taranaki", aliases: ["the warehouse new plymouth", "warehouse new plymouth", "tw new plymouth"] },
  "The Warehouse Rotorua": { region: "Bay of Plenty", aliases: ["the warehouse rotorua", "warehouse rotorua", "tw rotorua"] },
  "The Warehouse Masterton": { region: "Wellington", aliases: ["the warehouse masterton", "warehouse masterton", "tw masterton"] },
  
  "13 Ha Crescent, Harvey Norman Warehouse": { aliases: ["13 ha crescent", "ha crescent", "harvey norman warehouse", "hn warehouse", "east tamaki warehouse", "tamaki warehouse", "tamaki"] },
};

const STORE_NUMBER_MAP = {
  "21": "Wairau Park",
  "22": "Porirua",
  "27": "Pukekohe",
  "28": "Mt Wellington",
  "30": "Lower Hutt",
  "34": "Hastings",
  "36": "New Plymouth",
  "38": "Palmerston North",
  "40": "Porirua",
  "53": "Timaru",
  "74": "Whakatane"
};

const CACHE_FILE = path.join(__dirname, 'docling_cache.json');
let doclingCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    doclingCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.error("Error reading cache:", err.message);
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(doclingCache, null, 2), 'utf8');
}

const DOCLING_URL = "http://localhost:8000";

async function parseWithDocling(filePath, filename) {
  let cacheKey = filename || path.basename(filePath);
  if (fs.existsSync(filePath)) {
    try {
      cacheKey = fs.statSync(filePath).size + "_" + cacheKey;
    } catch (e) {}
  }
  if (doclingCache[cacheKey]) {
    return doclingCache[cacheKey];
  }
  
  const ext = path.extname(filename || "").toLowerCase();
  const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
  if (!validExts.includes(ext)) {
    return null;
  }

  console.log(`  [Docling Parse] Requesting Docling parse for ${filename}...`);
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename });
    const response = await axios.post(`${DOCLING_URL}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    doclingCache[cacheKey] = response.data;
    saveCache();
    return response.data;
  } catch (e) {
    console.error(`  [Docling Error] service error for ${filename}:`, e.message);
    return null;
  }
}

function matchStore(text) {
  if (!text) return null;
  const cleanText = text.toLowerCase().replace(/\s+/g, " ");
  
  if (/^(dav\s*transport|btdav|bt\s*transport)/i.test(cleanText) && cleanText.length < 50) {
    return null;
  }
  
  // 1. Check for Store Numbers near keywords to avoid false positives
  const storeNumMatch = cleanText.match(/\b(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture|dept|department|sales|office|box|ph|phone|ext)[,\s#\-\.]*(21|22|27|28|30|34|36|38|40|53|74)\b/) ||
                        cleanText.match(/\b(21|22|27|28|30|34|36|38|40|53|74)[,\s#\-\.]*(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture|dept|department|sales|office)\b/);
  
  if (storeNumMatch) {
    const num = storeNumMatch[1];
    const mappedStoreName = STORE_NUMBER_MAP[num];
    if (mappedStoreName) return mappedStoreName;
  }

  const exactNumMatch = cleanText.trim().match(/^(21|22|27|28|30|34|36|38|40|53|74)$/);
  if (exactNumMatch) {
    const mappedStoreName = STORE_NUMBER_MAP[exactNumMatch[1]];
    if (mappedStoreName) return mappedStoreName;
  }

  // 2. Check for Store Names in local part of email
  if (cleanText.includes("@")) {
    const localPart = cleanText.split("@")[0].replace(/[^a-z0-9]/g, "");
    for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
      const nameClean = storeName.toLowerCase().replace(/\s+/g, "");
      if (localPart.includes(nameClean)) {
        return storeName;
      }
      if (data.aliases) {
        for (const alias of data.aliases) {
          const aliasClean = alias.toLowerCase().replace(/\s+/g, "");
          if (localPart.includes(aliasClean)) {
            return storeName;
          }
        }
      }
    }
  }

  // 3. Regular name and alias check (prioritize longer matches)
  const candidates = [];
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    const nameLower = storeName.toLowerCase();
    const escapedName = nameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
    
    if (regex.test(cleanText) || cleanText.includes(nameLower)) {
      candidates.push({ name: storeName, length: nameLower.length });
    }
    
    if (data.aliases) {
      for (const alias of data.aliases) {
        const escapedAlias = alias.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const aliasRegex = new RegExp(`\\b${escapedAlias}\\b`, 'i');
        if (aliasRegex.test(cleanText) || cleanText.includes(alias.toLowerCase())) {
          candidates.push({ name: storeName, length: alias.length });
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0].name;
  }
  
  if (cleanText.includes("13 ha crescent") || cleanText.includes("ha crescent") || cleanText.includes("harvey norman warehouse")) {
    return "13 Ha Crescent, Harvey Norman Warehouse";
  }

  return null;
}

function extractStoreFromOrderNumber(text) {
  if (!text) return null;
  const orderNumRegex = /(?:NZ|PONZ|SONZ|PO|SO)?[-_#\s\/]*(0\d{2}|\d{2,3})[-\d\/]{5,}/i;
  const match = text.match(orderNumRegex);
  if (match) {
    const num = parseInt(match[1], 10).toString();
    const storeName = STORE_NUMBER_MAP[num];
    if (storeName) return storeName;
  }
  return null;
}

function findAllStoresInText(text) {
  if (!text) return [];
  const cleanText = text.toLowerCase();
  const foundStores = new Set();
  
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    const nameLower = storeName.toLowerCase();
    if (cleanText.includes(nameLower)) {
      foundStores.add(storeName);
    }
    if (data.aliases) {
      for (const alias of data.aliases) {
        if (alias.length <= 3) continue;
        if (cleanText.includes(alias.toLowerCase())) {
          foundStores.add(storeName);
        }
      }
    }
  }

  const storeNumPattern = /\b(?:21|22|27|28|30|34|36|38|40|53|74)\b/g;
  let match;
  while ((match = storeNumPattern.exec(cleanText)) !== null) {
    const num = match[0];
    const idx = match.index;
    const surrounding = cleanText.substring(Math.max(0, idx - 15), Math.min(cleanText.length, idx + 15));
    if (/(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture|dept|department|sales|office|box|ph|phone|ext)/i.test(surrounding)) {
      const mapped = STORE_NUMBER_MAP[num];
      if (mapped) foundStores.add(mapped);
    }
  }

  return Array.from(foundStores);
}

function extractRouteFromContent(subject, fromAddress, bodyText, attachmentsText) {
  let comingFrom = null;
  let destination = null;

  const combinedText = [
    `Subject: ${subject || ""}`,
    `From Address: ${fromAddress || ""}`,
    `Body: ${bodyText || ""}`,
    `Attachments: ${attachmentsText || ""}`
  ].join("\n");
  
  const cleanCombinedText = combinedText.toLowerCase().replace(/\s+/g, " ");
  
  // 1. Try explicit routing transitions like StoreA to StoreB
  const storeMap = {};
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    storeMap[storeName.toLowerCase()] = storeName;
    if (data.aliases) {
      for (const alias of data.aliases) {
        storeMap[alias.toLowerCase()] = storeName;
      }
    }
  }
  const keys = Object.keys(storeMap).sort((a, b) => b.length - a.length);
  const escapedKeys = keys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const storePatternStr = `(?:${escapedKeys.join('|')})`;
  
  const prefixPattern = '(?:hn\\s+|harvey\\s+norman\\s+|tw\\s+|the\\s+warehouse\\s+)?';
  const transitionRegex = new RegExp(`(?:${prefixPattern})(${storePatternStr})\\s*(?:store|branch|warehouse|whouse|wh|showrooms?)?\\s*(?:to|2|->|\\-|\\/)\\s*(?:the\\s+)?(?:${prefixPattern})(${storePatternStr})`, 'i');
  
  const matchTransition = cleanCombinedText.match(transitionRegex);
  if (matchTransition) {
    comingFrom = storeMap[matchTransition[1].trim()];
    destination = storeMap[matchTransition[2].trim()];
  }

  // 1.5 Try explicit layout patterns
  if (!comingFrom) {
    const pickupMatch = combinedText.match(/(?:Pickup\s+From|Collection\s+From|Transfer\s+From|BT\s+From|Origin|Supplier)[:\s]+([A-Za-z0-9\s,\.\-\(\)\#]+)/i);
    if (pickupMatch) {
      const store = matchStore(pickupMatch[1]);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        comingFrom = store;
      }
    }
  }

  if (!destination) {
    const deliverMatch = combinedText.match(/(?:Deliver\s+To|Delivery\s+To|Delivery\s+Address|Shipping\s+Address|BT\s+To|Destination|Ship\s+To|Customer\s+Address)[:\s]+([A-Za-z0-9\s,\.\-\(\)\#\/]+)/i);
    if (deliverMatch) {
      const store = matchStore(deliverMatch[1]);
      if (store) {
        destination = store;
      }
    }
  }

  // 2. Try subject directional indicators
  const cleanSubject = (subject || "").toLowerCase().replace(/\s+/g, " ");
  if (!comingFrom) {
    const fromMatch = cleanSubject.match(new RegExp(`(?:bt|transfer)\\s+from\\s+(${storePatternStr})`, 'i'));
    if (fromMatch) {
      comingFrom = storeMap[fromMatch[1].trim()];
    }
  }
  if (!destination) {
    const toMatch = cleanSubject.match(new RegExp(`(?:bt|transfer)\\s+to\\s+(${storePatternStr})`, 'i'));
    if (toMatch) {
      destination = storeMap[toMatch[1].trim()];
    }
  }

  // 3. Try to identify the Requester Store
  let requesterStore = null;
  const lines = (bodyText || "").split('\n');
  for (const line of lines) {
    const cleanLine = line.replace(/\*/g, "").trim();
    if (cleanLine.toLowerCase().startsWith("from:")) {
      const candidate = cleanLine.substring(5).trim();
      const store = matchStore(candidate);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        requesterStore = store;
        break;
      }
    }
  }
  
  if (!requesterStore) {
    requesterStore = matchStore(fromAddress);
  }

  // 3.5 Identify email recipient store
  let emailRecipientStore = null;
  for (const line of lines) {
    const cleanLine = line.replace(/\*/g, "").trim();
    if (cleanLine.toLowerCase().startsWith("to:")) {
      const candidate = cleanLine.substring(3).trim();
      const store = matchStore(candidate);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        emailRecipientStore = store;
        break;
      }
    }
  }

  if (emailRecipientStore && emailRecipientStore !== requesterStore) {
    if (!destination) {
      destination = emailRecipientStore;
    }
  }

  // 4. Try to identify any Other Store
  let otherStore = null;
  for (const storeName of Object.keys(STORE_REGISTRY)) {
    if (storeName === "13 Ha Crescent, Harvey Norman Warehouse") continue;
    const cleanName = storeName.toLowerCase();
    const data = STORE_REGISTRY[storeName];
    
    let found = cleanCombinedText.includes(cleanName);
    if (!found && data.aliases) {
      for (const alias of data.aliases) {
        if (cleanCombinedText.includes(alias.toLowerCase())) {
          found = true;
          break;
        }
      }
    }
    
    if (found && storeName !== requesterStore) {
      otherStore = storeName;
      break;
    }
  }

  // 5. Apply the Requester-Other store rule
  if (requesterStore && otherStore) {
    if (!comingFrom) comingFrom = otherStore;
    if (!destination) destination = requesterStore;
  }

  // 6. Try order/PO number store prefix matching
  if (!comingFrom || !destination) {
    const orderStore = extractStoreFromOrderNumber(combinedText);
    if (orderStore) {
      if (!comingFrom && destination && orderStore !== destination) {
        comingFrom = orderStore;
      } else if (!destination && comingFrom && orderStore !== comingFrom) {
        destination = orderStore;
      } else if (!comingFrom && !destination) {
        comingFrom = orderStore;
      }
    }
  }

  // 7. Single-store mention / Return to store rule
  if ((!comingFrom || comingFrom === "Not identified") && (!destination || destination === "Not identified")) {
    const allFound = findAllStoresInText(combinedText);
    const uniqueStore = allFound.length === 1 ? allFound[0] : (requesterStore || null);
    
    if (uniqueStore && uniqueStore !== "13 Ha Crescent, Harvey Norman Warehouse") {
      const isReturn = /return\s+to\s+store|rts\b/i.test(cleanCombinedText);
      if (isReturn) {
        comingFrom = "Not identified";
        destination = uniqueStore;
      } else {
        comingFrom = uniqueStore;
        destination = "Not identified";
      }
    }
  }
  
  // 8. Zero-Distance Loop Check
  if (comingFrom && destination && comingFrom !== "Not identified" && destination !== "Not identified" && comingFrom === destination) {
    const isReturn = /return\s+to\s+store|rts\b/i.test(cleanCombinedText);
    if (isReturn) {
      comingFrom = "Not identified";
    } else {
      destination = "Not identified";
    }
  }
  
  return {
    comingFrom: comingFrom || "Not identified",
    destination: destination || "Not identified"
  };
}

function extractInvoiceNo(combinedContent) {
  const hnPattern = /(?:PONZ|SONZ|NZ|PO|SO|Invoice|Inv|Order|PO#|SO#)[:\s#\-_]*([A-Z0-9]*NZ[\d\-]{5,})/gi;
  let hnMatch;
  while ((hnMatch = hnPattern.exec(combinedContent)) !== null) {
    const val = hnMatch[1].trim();
    if (val.length >= 5) return val;
  }
  
  const simpleHnPattern = /\b(NZ[\d\-]{5,})\b/gi;
  let simpleHnMatch;
  while ((simpleHnMatch = simpleHnPattern.exec(combinedContent)) !== null) {
    return simpleHnMatch[1].trim();
  }

  const patterns = [
    /\b(?:INV|INVOICE|PO|SO|Order|Ref|Transaction)\b(?:\s+(?:reprint|copy|duplicate|original|status|date|no|number|tax|invoice|report|purchase|sales|re-print))*[:\s#\-_]+([A-Z0-9\-_\/]+)/gi
  ];
  
  const blacklist = /^(and|to|for|the|from|with|status|subject|date|page|image|attached|please|ready|collect|collecting|accepted|pending|scan|scanned|attached|find|re|reprint|re-print|copy|duplicate|original|invoice|order|draft|statement|report|pos|paid|unpaid|cancelled|yes|no|nil|null|none|details|transaction|type|cash|sale|assistant|operator|location|phone|receipt)$/i;

  for (const pat of patterns) {
    let match;
    pat.lastIndex = 0;
    while ((match = pat.exec(combinedContent)) !== null) {
      const val = match[1].trim();
      if (val.length >= 3 && !blacklist.test(val) && !val.includes("@") && !/dav/i.test(val)) {
        return val;
      }
    }
  }
  
  const numericInvoice = combinedContent.match(/\b(2\d{6})\b/);
  if (numericInvoice) {
    return numericInvoice[1];
  }
  
  return "Not identified";
}

async function run() {
  const orders = await Order.findAll();
  console.log(`Loaded ${orders.length} orders from database for v2 reprocessing test...\n`);
  
  let unresolvedCount = 0;
  let matchesCount = 0;
  
  for (const order of orders) {
    const norm = order.normalized_data || {};
    
    // Query attachments using DB model
    let attachmentsText = "";
    const attachments = await EmailAttachment.findAll({ where: { order_id: order.id } });
    
    for (const att of attachments) {
      if (fs.existsSync(att.file_path)) {
        const parsedDoc = await parseWithDocling(att.file_path, att.filename);
        if (parsedDoc && parsedDoc.raw_markdown) {
          attachmentsText += parsedDoc.raw_markdown + "\n";
        }
      }
    }
    
    const combinedContent = [
      `Subject: ${order.email_subject || ""}`,
      `From: ${order.email_from || ""}`,
      `Body: ${order.raw_email_body || ""}`,
      `Attachments Text: ${attachmentsText}`
    ].join("\n");

    const route = extractRouteFromContent(order.email_subject, order.email_from, order.raw_email_body, attachmentsText);
    const invoiceNo = extractInvoiceNo(combinedContent);
    
    const oldInvoice = norm.invoiceNo || "Not identified";
    const oldComingFrom = norm.comingFrom || "Not identified";
    const oldDestination = norm.destination || "Not identified";

    const newInvoice = invoiceNo !== "Not identified" ? invoiceNo : oldInvoice;
    const newComingFrom = route.comingFrom !== "Not identified" ? route.comingFrom : oldComingFrom;
    const newDestination = route.destination !== "Not identified" ? route.destination : oldDestination;

    // Apply loop check for final output
    let finalComingFrom = newComingFrom;
    let finalDestination = newDestination;
    if (finalComingFrom !== "Not identified" && finalDestination !== "Not identified" && finalComingFrom === finalDestination) {
      const isReturn = /return\s+to\s+store|rts\b/i.test(combinedContent);
      if (isReturn) {
        finalComingFrom = "Not identified";
      } else {
        finalDestination = "Not identified";
      }
    }

    const isStillUnidentified = 
      newInvoice === "Not identified" || 
      finalComingFrom === "Not identified" || 
      finalDestination === "Not identified";

    if (isStillUnidentified) {
      unresolvedCount++;
    } else {
      matchesCount++;
    }

    if (oldComingFrom !== finalComingFrom || oldDestination !== finalDestination || oldInvoice !== newInvoice) {
      console.log(`ID: ${order.id}`);
      console.log(`Subject: ${order.email_subject}`);
      console.log(`Old: Invoice: "${oldInvoice}" | From: "${oldComingFrom}" | To: "${oldDestination}"`);
      console.log(`New: Invoice: "${newInvoice}" | From: "${finalComingFrom}" | To: "${finalDestination}"`);
      if (isStillUnidentified) {
        console.log(`  --> STILL UNRESOLVED!`);
      }
      console.log("------------------------------------------------");
    }
  }
  
  console.log(`\nReprocessing v2 Summary:`);
  console.log(`Total Orders: ${orders.length}`);
  console.log(`Fully Identified Orders: ${matchesCount}`);
  console.log(`Still Unidentified Orders: ${unresolvedCount}`);
  
  await sequelize.close();
}

run().catch(console.error);
