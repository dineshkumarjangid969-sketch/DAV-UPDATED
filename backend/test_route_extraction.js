const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'dav_transport.db'),
  logging: false,
});

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
  "13 Ha Crescent, Harvey Norman Warehouse": { aliases: ["13 ha crescent", "ha crescent", "harvey norman warehouse", "hn warehouse", "east tamaki warehouse", "tamaki warehouse", "tamaki"] },
};

const STORE_NUMBER_MAP = {
  "21": "Wairau Park",
  "22": "Porirua",
  "27": "Pukekohe",
  "28": "Mt Wellington",
  "30": "Lower Hutt", // Wait, let's verify if Lower Hutt is 30. We found 30.Fax in Lower Hutt BTs.
  "34": "Hastings",
  "36": "New Plymouth",
  "38": "Palmerston North",
  "40": "Porirua",
  "53": "Timaru",
  "74": "Whakatane"
};

function matchStore(text) {
  if (!text) return null;
  const cleanText = text.toLowerCase().replace(/\s+/g, " ");
  
  if (/^(dav\s*transport|btdav|bt\s*transport)/i.test(cleanText) && cleanText.length < 50) {
    return null;
  }
  
  // 1. Check for Store Numbers near keywords to avoid false positives (e.g. Hwy 30)
  const storeNumMatch = cleanText.match(/\b(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture)[,\s#\-\.]*(21|22|27|28|30|34|36|38|40|53|74)\b/) ||
                        cleanText.match(/\b(21|22|27|28|30|34|36|38|40|53|74)[,\s#\-\.]*(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture)\b/);
  if (storeNumMatch) {
    const num = storeNumMatch[1];
    const mappedStoreName = STORE_NUMBER_MAP[num];
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

  // 3. Regular name and alias check
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    const nameLower = storeName.toLowerCase();
    const escapedName = nameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
    if (regex.test(cleanText) || cleanText.includes(nameLower)) {
      return storeName;
    }
    
    if (data.aliases) {
      for (const alias of data.aliases) {
        const escapedAlias = alias.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const aliasRegex = new RegExp(`\\b${escapedAlias}\\b`, 'i');
        if (aliasRegex.test(cleanText) || cleanText.includes(alias.toLowerCase())) {
          return storeName;
        }
      }
    }
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

function extractRouteFromContent(subject, fromAddress, bodyText, attachmentsText) {
  let comingFrom = null;
  let destination = null;

  // Combine subject, bodyText and attachmentsText
  const combinedText = [
    `Subject: ${subject || ""}`,
    `From Address: ${fromAddress || ""}`,
    `Body: ${bodyText || ""}`,
    `Attachments: ${attachmentsText || ""}`
  ].join("\n");
  
  const cleanCombinedText = combinedText.toLowerCase().replace(/\s+/g, " ");
  
  // Build pattern of all stores
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
  
  // 1. Try explicit routing transition (e.g. "from StoreA to StoreB")
  const matchTransition = cleanCombinedText.match(transitionRegex);
  if (matchTransition) {
    comingFrom = storeMap[matchTransition[1].trim()];
    destination = storeMap[matchTransition[2].trim()];
  }

  // 1.5 Try explicit layout patterns in combinedText
  if (!comingFrom) {
    const pickupMatch = combinedText.match(/(?:Pickup\s+From|Collection\s+From|Transfer\s+From|BT\s+From|Origin|Supplier|From)[:\s]+([A-Za-z0-9\s,\.\-\(\)\#]+)/i);
    if (pickupMatch) {
      const store = matchStore(pickupMatch[1]);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        comingFrom = store;
      }
    }
  }

  if (!destination) {
    const deliverMatch = combinedText.match(/(?:Deliver\s+To|Delivery\s+To|Delivery\s+Address|Shipping\s+Address|BT\s+To|To|Destination|Ship\s+To|Customer\s+Address)[:\s]+([A-Za-z0-9\s,\.\-\(\)\#\/]+)/i);
    if (deliverMatch) {
      const store = matchStore(deliverMatch[1]);
      if (store) {
        destination = store;
      }
    }
  }

  // 2. Try subject directional indicators (e.g. "BT from StoreA")
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

  // 3. Try to identify the Requester Store (sender or forwarded sender)
  let requesterStore = null;
  
  // Check forwarded "From:" and "To:" headers in the email body
  const lines = (bodyText || "").split('\n');
  for (const line of lines) {
    if (line.toLowerCase().startsWith("from:")) {
      const candidate = line.substring(5).trim();
      const store = matchStore(candidate);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        requesterStore = store;
        break;
      }
    }
  }
  
  for (const line of lines) {
    if (line.toLowerCase().startsWith("to:")) {
      const candidate = line.substring(3).trim();
      const store = matchStore(candidate);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        if (!destination) {
          destination = store;
        }
      }
    }
  }
  
  // If not found in body, check the top-level From address
  if (!requesterStore) {
    requesterStore = matchStore(fromAddress);
  }

  // 4. Try to identify any Other Store mentioned in the combined text
  let otherStore = null;
  for (const storeName of Object.keys(STORE_REGISTRY)) {
    if (storeName === "13 Ha Crescent, Harvey Norman Warehouse") continue;
    
    // Check if the store name or any of its aliases is in the text
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

  // 6. Try order/PO number store prefix matching (if still unresolved)
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
  
  return {
    comingFrom: comingFrom || "Not identified",
    destination: destination || "Not identified"
  };
}

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const DOCLING_URL = "http://localhost:8000";

async function parseWithDocling(filePath, filename) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename });
    const response = await axios.post(`${DOCLING_URL}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    return response.data;
  } catch (e) {
    console.error(`Docling service error for ${filename}:`, e.message);
    return null;
  }
}

async function run() {
  const [results] = await sequelize.query(`
    SELECT id, email_subject, email_from, raw_email_body, attachment_paths, normalized_data 
    FROM orders 
    WHERE normalized_data LIKE '%"comingFrom":"Not identified"%' 
       OR normalized_data LIKE '%"destination":"Not identified"%'
       OR normalized_data LIKE '%"invoiceNo":"Not identified"%'
    LIMIT 10
  `);
  
  console.log(`Testing route extraction on ${results.length} unresolved orders...\n`);
  
  for (const r of results) {
    const norm = JSON.parse(r.normalized_data || '{}');
    
    // Parse attachments with Docling
    let attachmentsText = "";
    let rawTables = [];
    const attPaths = JSON.parse(r.attachment_paths || '[]');
    
    for (const filePath of attPaths) {
      if (fs.existsSync(filePath)) {
        const filename = path.basename(filePath);
        console.log(`Parsing attachment ${filename} for order ${r.id}...`);
        const parsedDoc = await parseWithDocling(filePath, filename);
        if (parsedDoc) {
          if (parsedDoc.raw_markdown) {
            attachmentsText += parsedDoc.raw_markdown + "\n";
          }
          if (parsedDoc.raw_tables) {
            rawTables = rawTables.concat(parsedDoc.raw_tables);
          }
        }
      }
    }
    
    const route = extractRouteFromContent(r.email_subject, r.email_from, r.raw_email_body, attachmentsText);
    
    console.log(`\nID: ${r.id}`);
    console.log(`Subject: ${r.email_subject}`);
    console.log(`From Email: ${r.email_from}`);
    console.log(`Old: From: "${norm.comingFrom}" | To: "${norm.destination}"`);
    console.log(`New: From: "${route.comingFrom}" | To: "${route.destination}"`);
    console.log("------------------------------------------------\n");
  }
  
  await sequelize.close();
}

run().catch(console.error);
