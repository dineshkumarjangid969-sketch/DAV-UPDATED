const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Haversine formula for distance between two lat/lon pairs
function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const GEOCODE_CACHE_FILE = path.join(__dirname, 'geocode_cache.json');
let geocodeCache = {};
try {
  if (fs.existsSync(GEOCODE_CACHE_FILE)) {
    geocodeCache = JSON.parse(fs.readFileSync(GEOCODE_CACHE_FILE, 'utf8'));
  }
} catch (e) {
  console.error("Could not load geocode cache:", e.message);
}

function saveGeocodeCache() {
  try {
    fs.writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(geocodeCache, null, 2));
  } catch (e) {
    console.error("Could not save geocode cache:", e.message);
  }
}

// 1. Geocoding Wrapper
async function geocodeAddress(address) {
  if (!address || address.trim() === "") return null;
  const normalizedAddress = address.trim().toLowerCase();
  
  if (geocodeCache[normalizedAddress]) {
    return geocodeCache[normalizedAddress];
  }

  // 1. Check if Google Maps API key is available
  const googleKey = process.env.GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const res = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
        params: { address: address, key: googleKey }
      });
      if (res.data.status === 'OK' && res.data.results.length > 0) {
        const loc = res.data.results[0].geometry.location;
        const coords = { lat: loc.lat, lon: loc.lng };
        geocodeCache[normalizedAddress] = coords;
        saveGeocodeCache();
        return coords;
      }
    } catch (e) {
      console.error("Google Geocoding failed:", e.message);
    }
  } else {
    // 2. Fallback to OpenStreetMap Nominatim
    try {
      // Nominatim requires User-Agent
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { q: address + ', New Zealand', format: 'json', limit: 1 },
        headers: { 'User-Agent': 'DAV-Transport-Routing-Engine/1.0' }
      });
      if (res.data && res.data.length > 0) {
        const coords = { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) };
        geocodeCache[normalizedAddress] = coords;
        saveGeocodeCache();
        // Respect rate limit for Nominatim (1 request per second)
        await new Promise(r => setTimeout(r, 1000));
        return coords;
      }
    } catch (e) {
      console.error("Nominatim Geocoding failed:", e.message);
    }
  }
  return null;
}

// 2. The Fulfill & Flush Algorithm (Capacitated CVRP)
function optimizeRoute(orders, storeRegistry, fleetConfig = []) {
  // If no fleet provided, fallback to 1 generic truck
  if (!fleetConfig || fleetConfig.length === 0) {
    fleetConfig = [{ id: 1, driver: "Default", capacity: 5000, hasOffsider: true }];
  }

  // Pre-process orders to ensure size
  const processedOrders = orders.map(o => {
    // Attempt to parse size. If string like "1.2m3" or "1.2CBM", parse to float.
    let s = parseFloat(o.size || o.Size || o['Size (m³)'] || o.CBM || o.Volume);
    if (isNaN(s)) {
      // Guess size based on description or default
      const desc = (o.description || o.item || "").toLowerCase();
      if (desc.includes('fridge') || desc.includes('refrigerator')) s = 1.2;
      else if (desc.includes('washer') || desc.includes('dryer')) s = 0.5;
      else if (desc.includes('tv') || desc.includes('television')) s = 0.2;
      else s = 0.1; // Default 0.1 m³
    }
    return { ...o, parsedSize: s };
  });

  const unassignedOrders = [];

  // Group pending orders by pickup_store
  const clusters = {};
  for (const order of processedOrders) {
    const pStore = order.pickup_store || "Unknown";
    if (!clusters[pStore]) clusters[pStore] = [];
    clusters[pStore].push(order);
  }

  // Geographic sectoring: Sort clusters by angle from Wiri DC to split among trucks
  const wiriLat = -37.0125;
  const wiriLon = 174.8624;
  
  const clusterList = Object.keys(clusters).map(storeName => {
    const data = storeRegistry[storeName] || { lat: wiriLat, lon: wiriLon };
    const angle = Math.atan2(data.lon - wiriLon, data.lat - wiriLat);
    return { name: storeName, data, angle };
  });

  // Sort by angle for geographic sweeping
  clusterList.sort((a, b) => a.angle - b.angle);

  // Initialize Trucks
  const trucks = fleetConfig.map(tc => ({
    truckId: tc.id,
    driver: tc.driver || `Truck ${tc.id}`,
    maxCapacity: tc.capacity || 5000,
    hasOffsider: tc.hasOffsider || false,
    currentLoad: 0,
    waypoints: [],
    totalDistance: 0
  }));

  let currentTruckIdx = 0;

  for (const cluster of clusterList) {
    const storeName = cluster.name;
    const storeOrders = clusters[storeName];

    for (const order of storeOrders) {
      const size = order.parsedSize;
      const requiresOffsider = size > 1.0; // 1.0 m3 threshold for 2-man lift

      // Find best truck for this order
      let assigned = false;
      
      for (let i = 0; i < trucks.length; i++) {
        const tIdx = (currentTruckIdx + i) % trucks.length;
        const truck = trucks[tIdx];

        // Check Constraints
        if (requiresOffsider && !truck.hasOffsider) continue;
        if (truck.currentLoad + size > truck.maxCapacity) continue;

        // Valid truck found! Assign order to truck's local cluster pool
        if (!truck.pendingClusters) truck.pendingClusters = {};
        if (!truck.pendingClusters[storeName]) truck.pendingClusters[storeName] = [];
        
        truck.pendingClusters[storeName].push(order);
        truck.currentLoad += size;
        assigned = true;
        
        currentTruckIdx = tIdx; 
        break;
      }

      if (!assigned) {
        unassignedOrders.push(order);
      }
    }
  }

  // Run Fulfill & Flush for each truck
  for (const truck of trucks) {
    let currentLocation = { name: "Wiri DC", lat: wiriLat, lon: wiriLon, isOrigin: true };
    truck.waypoints.push({ ...currentLocation, type: "START" });
    
    if (!truck.pendingClusters) truck.pendingClusters = {};
    const unvisitedStores = Object.keys(truck.pendingClusters);

    while (unvisitedStores.length > 0) {
      // FULFILL: Nearest assigned cluster
      let nearestStoreName = null;
      let shortestDist = Infinity;
      let nearestStoreCoords = null;

      for (const storeName of unvisitedStores) {
        const storeData = storeRegistry[storeName] || { lat: wiriLat, lon: wiriLon };
        const dist = getDistanceKM(currentLocation.lat, currentLocation.lon, storeData.lat, storeData.lon);
        if (dist < shortestDist) {
          shortestDist = dist;
          nearestStoreName = storeName;
          nearestStoreCoords = { lat: storeData.lat, lon: storeData.lon };
        }
      }

      const ordersToPickupNow = truck.pendingClusters[nearestStoreName];

      truck.waypoints.push({
        type: "PICKUP",
        name: nearestStoreName,
        lat: nearestStoreCoords.lat,
        lon: nearestStoreCoords.lon,
        distanceFromPrev: shortestDist === Infinity ? 0 : shortestDist,
        ordersToPickup: ordersToPickupNow.map(o => o.order_number || o.invoice_number),
        size: ordersToPickupNow.reduce((sum, o) => sum + o.parsedSize, 0)
      });
      truck.totalDistance += (shortestDist === Infinity ? 0 : shortestDist);
      currentLocation = { name: nearestStoreName, ...nearestStoreCoords };
      unvisitedStores.splice(unvisitedStores.indexOf(nearestStoreName), 1);

      // FLUSH: TSP for drop-offs
      let pendingDeliveries = [...ordersToPickupNow];
      while (pendingDeliveries.length > 0) {
        let nearestOrderIdx = -1;
        let minDropDist = Infinity;
        for (let j = 0; j < pendingDeliveries.length; j++) {
          const o = pendingDeliveries[j];
          if (!o.dest_lat || !o.dest_lon) {
            nearestOrderIdx = j;
            minDropDist = 0;
            break;
          }
          const dist = getDistanceKM(currentLocation.lat, currentLocation.lon, o.dest_lat, o.dest_lon);
          if (dist < minDropDist) {
            minDropDist = dist;
            nearestOrderIdx = j;
          }
        }
        if (nearestOrderIdx === -1) nearestOrderIdx = 0;

        const nextDelivery = pendingDeliveries.splice(nearestOrderIdx, 1)[0];
        const dLat = nextDelivery.dest_lat || currentLocation.lat;
        const dLon = nextDelivery.dest_lon || currentLocation.lon;

        truck.waypoints.push({
          type: "DROPOFF",
          name: nextDelivery.destination_address || nextDelivery.destination_store || "Unknown Destination",
          lat: dLat,
          lon: dLon,
          distanceFromPrev: minDropDist === Infinity ? 0 : minDropDist,
          orderId: nextDelivery.id,
          orderNumber: nextDelivery.order_number || nextDelivery.invoice_number,
          size: nextDelivery.parsedSize
        });
        truck.totalDistance += (minDropDist === Infinity ? 0 : minDropDist);
        currentLocation = { name: "Dropoff", lat: dLat, lon: dLon };
      }
    }

    // Return to Wiri DC
    const finalDist = getDistanceKM(currentLocation.lat, currentLocation.lon, wiriLat, wiriLon);
    truck.waypoints.push({
      type: "END",
      name: "Wiri DC",
      lat: wiriLat,
      lon: wiriLon,
      distanceFromPrev: finalDist
    });
    truck.totalDistance += finalDist;
    truck.totalDistance = parseFloat(truck.totalDistance.toFixed(1));
    
    truck.utilization = truck.maxCapacity > 0 ? parseFloat(((truck.currentLoad / truck.maxCapacity) * 100).toFixed(1)) : 0;
    delete truck.pendingClusters;
  }

  return { trucks, unassignedOrders };
}

module.exports = {
  geocodeAddress,
  optimizeRoute,
  getDistanceKM
};
