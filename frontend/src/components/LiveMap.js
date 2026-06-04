import React, { useEffect, useRef, useState } from "react";
import API from "../services/api";
import { RefreshCw, MapPin, Navigation, Package } from "lucide-react";

export default function LiveMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stores, setStores] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [orders, setOrders] = useState([]);

  const loadDataAndInitMap = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resStores, resTrucks, resOrders] = await Promise.all([
        API.get("/stores"),
        API.get("/trucks"),
        API.get("/orders?limit=500")
      ]);

      const fetchedStores = resStores.data || [];
      const fetchedTrucks = resTrucks.data || [];
      const fetchedOrders = resOrders.data?.orders || [];

      setStores(fetchedStores);
      setTrucks(fetchedTrucks);
      setOrders(fetchedOrders);

      // Initialize or refresh map markers
      initMap(fetchedStores, fetchedTrucks, fetchedOrders);
    } catch (err) {
      console.error("Failed to load map data:", err);
      setError("Unable to connect to mapping services. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataAndInitMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initMap = (storesList, trucksList, ordersList) => {
    const L = window.L;
    if (!L || !mapContainerRef.current) return;

    // Remove existing map instance if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Centered around New Zealand
    const map = L.map(mapContainerRef.current).setView([-37.8, 175.0], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapInstanceRef.current = map;

    // Custom Emoji Markers
    const truckIcon = L.divIcon({
      html: `<div style="background:#ff7b00;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.5)">🚚</div>`,
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const storeIcon = L.divIcon({
      html: `<div style="background:#1e3a8a;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #ff7b00;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.5)">🏪</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const orderIcon = L.divIcon({
      html: `<div style="background:#10b981;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;font-size:10px;box-shadow:0 2px 8px rgba(0,0,0,.5)">📦</div>`,
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    // Plot stores
    storesList.forEach(s => {
      const lat = s.lat || s.latitude;
      const lon = s.lon || s.longitude;
      if (lat && lon) {
        L.marker([lat, lon], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`
            <div style="color: #333; font-family: sans-serif;">
              <strong style="font-size: 13px; color: #1e3a8a;">🏪 ${s.name || "Harvey Norman Store"}</strong>
              <p style="margin: 4px 0 0 0; font-size: 11px;">${s.address || "No address"}</p>
              ${s.phone ? `<p style="margin: 2px 0 0 0; font-size: 10px; color: #666;">📞 Phone: ${s.phone}</p>` : ""}
            </div>
          `);
      }
    });

    // Plot trucks
    trucksList.forEach(t => {
      const lat = t.current_lat || t.lat;
      const lon = t.current_lon || t.lon;
      if (lat && lon) {
        L.marker([lat, lon], { icon: truckIcon })
          .addTo(map)
          .bindPopup(`
            <div style="color: #333; font-family: sans-serif;">
              <strong style="font-size: 13px; color: #ff7b00;">🚚 Truck: ${t.license_plate}</strong>
              <p style="margin: 4px 0 0 0; font-size: 11px;"><b>Driver:</b> ${t.driver_name || "Unassigned"}</p>
              <p style="margin: 2px 0 0 0; font-size: 11px;"><b>Status:</b> ${t.is_online ? "🟢 Online" : "🔴 Offline"}</p>
              <p style="margin: 2px 0 0 0; font-size: 11px;"><b>Load Capacity:</b> ${t.current_load_cbm || 0}/${t.capacity_cbm || 50} CBM</p>
            </div>
          `);
      }
    });

    // Plot orders
    ordersList
      .filter(o => (o.dest_lat && o.dest_lon) || (o.pickup_lat && o.pickup_lon))
      .forEach(o => {
        const lat = o.dest_lat || o.pickup_lat;
        const lon = o.dest_lon || o.pickup_lon;
        L.marker([lat, lon], { icon: orderIcon })
          .addTo(map)
          .bindPopup(`
            <div style="color: #333; font-family: sans-serif; min-width: 140px;">
              <strong style="font-size: 12px; color: #10b981;">📦 Order: ${o.order_number}</strong>
              <p style="margin: 4px 0 0 0; font-size: 11px;"><b>Client/Customer:</b> ${o.customer_name || o.client_name || "N/A"}</p>
              <p style="margin: 2px 0 0 0; font-size: 11px;"><b>Type:</b> ${(o.bt_type || o.type || "Delivery").replace(/_/g, " ")}</p>
              <p style="margin: 2px 0 0 0; font-size: 11px;"><b>Status:</b> <span style="text-transform: uppercase; font-weight: bold;">${o.status}</span></p>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: #555;"><b>Location:</b> ${o.location || "—"}</p>
            </div>
          `);
      });
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 shadow-2xl text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Navigation size={22} className="text-blue-400" /> Live Tracking Map
        </h2>
        <button
          onClick={loadDataAndInitMap}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-blue-400 border border-blue-500/25 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh Map
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map View */}
        <div className="lg:col-span-3 bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl" style={{ height: "60vh" }}>
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-slate-400 z-[1000]">
              <RefreshCw size={36} className="animate-spin text-blue-500 mb-2" />
              <span>Synching map tracking data...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-red-400 p-6 text-center z-[1000]">
              <span className="text-3xl mb-2">⚠️</span>
              <p className="font-semibold">{error}</p>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: "350px" }} />
        </div>

        {/* Legend / Info Panel */}
        <div className="space-y-4">
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-sm mb-4">MAP LEGEND</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-base">🏪</span>
                <div>
                  <p className="font-semibold text-blue-400">Stores ({stores.length})</p>
                  <p className="text-[10px] text-slate-500">Harvey Norman NZ Branches</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-base">🚚</span>
                <div>
                  <p className="font-semibold text-amber-500">Active Trucks ({trucks.length})</p>
                  <p className="text-[10px] text-slate-500">GPS locations & driver details</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-base">📦</span>
                <div>
                  <p className="font-semibold text-emerald-500">Orders ({orders.length})</p>
                  <p className="text-[10px] text-slate-500">Active dropoff destinations</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-2xl text-xs text-slate-400 space-y-2">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px]">Quick Telemetry</h4>
            <div className="flex justify-between border-b border-slate-800/50 py-1">
              <span>Online Trucks:</span>
              <span className="font-semibold text-white">{trucks.filter(t => t.is_online).length}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/50 py-1">
              <span>Pending Orders:</span>
              <span className="font-semibold text-white">{orders.filter(o => o.status === "pending").length}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>In Transit:</span>
              <span className="font-semibold text-white">{orders.filter(o => o.status === "in_progress" || o.status === "picked_up").length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
