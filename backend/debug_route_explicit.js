
const { matchStore, extractStoreFromOrderNumber, findAllStoresInText, STORE_REGISTRY } = require('./server.js');
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
  
  const btRouteRegex = new RegExp(`(?:bt\s*\d*|branch\s+transfer|goods\s+movement|offsite\s+to\s+showroom)\s*(?:[:\-–—\s]*)?(?:from\s+)?(${storePatternStr})\s*(?:to|→|\-|\/|2)\s*(${storePatternStr})`, 'i');
  const matchTransition = cleanCombinedText.match(transitionRegex);
  if (matchTransition) {
    comingFrom = storeMap[matchTransition[1].trim()];
    destination = storeMap[matchTransition[2].trim()];
  }

  const btRouteMatch = cleanCombinedText.match(btRouteRegex);
  if (btRouteMatch) {
    comingFrom = storeMap[btRouteMatch[1].trim()] || comingFrom;
    destination = storeMap[btRouteMatch[2].trim()] || destination;
  }

  // 1.1 Explicit phrases like "collect from X" or "deliver to Y" or "from X to Y"
  const directionalPattern = /(?:(?:pickup|collect|from)\s+from\s+)?(?:(?:harvey norman|hn|the warehouse|tw)\s+)?(Pukekohe|Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane|Mt\s+Wellington|Manukau|Porirua|New\s+Plymouth|Henderson)(?:\s+store|\s+warehouse|,\s+please)?\s+(?:and\s+)?(?:to\s+deliver\s+to\s+|to\s+|deliver\s+to\s+)(?:and\s+)?(?:(?:harvey norman|hn|the warehouse|tw)\s+)?(Pukekohe|Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane|Mt\s+Wellington|Manukau|Porirua|New\s+Plymouth|Henderson)/i;
  const dirMatch = cleanCombinedText.match(directionalPattern);
  if (dirMatch) {
    if (!comingFrom) comingFrom = matchStore(dirMatch[1]);
    if (!destination) destination = matchStore(dirMatch[2]);
  }

  // 1.2 Try explicit directional phrases
  const explicitStores = findAllStoresInText(combinedText);
  for (const store of explicitStores) {
    const storePattern = store.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (!comingFrom && new RegExp(`(?:from|pickup|pick up|collect|collection at)\\s+(?:this\\s+bt\\s+)?(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
      comingFrom = store;
    }
    if (!destination && new RegExp(`(?:and\\s+)?(?:to|deliver to|delivery to|dest|drop|drop off at|drop at|drop to)\\s+(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
      destination = store;
    }
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

  // New rule for custom non-standard destinations using lookahead
  if (!destination || destination === "Not identified") {
    // Terminate match before "for repair", "for [word]", punctuation, or end of string
    const customDestMatch = cleanCombinedText.match(/(?:going\s+back\s+to|going\s+to|return\s+to|deliver\s+to|drop\s+off\s+at)\s+([a-z0-9\s\-&]+?)(?=\s+(?:for\s+repair|for\s+\w+|\.|\n|,|$))/i);
    if (customDestMatch) {
      const candidate = customDestMatch[1].trim();
      if (candidate.length >= 3 && 
          !/^(the|this|that|us|we|our|you|him|her|them|store|warehouse|showroom|onsite|offsite|customer|repair)$/i.test(candidate) &&
          !candidate.includes("@") &&
          !candidate.includes("http")) {
        destination = candidate.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
  let requesterStore = null; console.log("Before Requester:", comingFrom, destination);
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
  
  if (!requesterStore) { console.log("Checking fromAddress:", fromAddress);
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
  console.log("requesterStore:", requesterStore); let otherStore = null;
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
  console.log("otherStore:", otherStore); if (requesterStore && otherStore) {
    if (!comingFrom) comingFrom = otherStore;
    if (!destination) destination = requesterStore;
  }

  // 6. Try order/PO number store prefix matching
  if (!comingFrom || !destination) {
    console.log("Before Rule 6:", comingFrom, destination); const orderStore = extractStoreFromOrderNumber(combinedText);
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

  // 7. Multi-store fallback rule
  if ((!comingFrom || comingFrom === "Not identified") && (!destination || destination === "Not identified")) {
    console.log("Before Rule 7:", comingFrom, destination); const allFound = findAllStoresInText(combinedText);
    if (allFound.length > 0) {
      const isReturn = /return\s+to\s+store|rts\b/i.test(cleanCombinedText);
      if (allFound.length === 1) {
        const uniqueStore = allFound[0];
        if (uniqueStore !== "13 Ha Crescent, Harvey Norman Warehouse") {
          comingFrom = isReturn ? "Not identified" : uniqueStore;
          destination = isReturn ? uniqueStore : "Not identified";
        }
      } else {
        // We have multiple stores, try to assign them sensibly
        // First, check explicit "from store" or "to store" phrases
        for (const store of allFound) {
          const storePattern = store.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          if (new RegExp(`(?:from|collection at)\\s+(?:this\\s+bt\\s+)?(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
            comingFrom = store;
          }
          if (new RegExp(`(?:to|delivery to|dest)\\s+(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
            destination = store;
          }
        }
        
        // If still missing, just pick the first two
        if (!comingFrom) comingFrom = allFound[0];
        if (!destination) {
          destination = allFound.find(s => s !== comingFrom) || "Not identified";
        }
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
  
  const addressMatch = cleanCombinedText.match(/## SHIPPING ADDRESS[\s\n]+([^\n]+)/i);
  const deliveryAddress = addressMatch && addressMatch[1] ? addressMatch[1].trim() : (destination || "Not identified");

  console.log("Returning:", comingFrom, destination); return {
    comingFrom: comingFrom || "Not identified",
    destination: destination || "Not identified",
    deliveryAddress
  };
}

const cache = require('./docling_cache.json');
const keys = Object.keys(cache).filter(k => cache[k].raw_markdown && cache[k].raw_markdown.includes('NZ0200000342578'));
const doclings = keys.map(k => cache[k]);

const subject = 'Fwd: Fw: PO# NZ0200000342578 - Order Status = Accepted (Pending)';
const from = 'Bedding, Manukau <Manukau.Bedding@nz.harveynorman.com>';
const body = 'Please collect this BT from Pukekohe store and deliver to Harvey Norman Wairau park warehouse.';
const html = '';

const attachmentsText = doclings.map(d => d.raw_markdown).join('\n');
extractRouteFromContent(subject, from, body, attachmentsText);
