import React, { useState, useEffect } from "react";
import API from "../services/api";
import { MapPin, Truck, Send, Calendar, ArrowUp, ArrowDown, Save, Plus, Users, Compass, ShieldAlert } from "lucide-react";

export default function RoutePlanner() {
  const [orders, setOrders] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [selectedOffsiders, setSelectedOffsiders] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startStore, setStartStore] = useState("Wairau Park");
  const [plans, setPlans] = useState([]);
  const [planResult, setPlanResult] = useState(null);
  
  // Optimization & Add-on states
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [nearestDriver, setNearestDriver] = useState(null);
  const [nearestDriverStore, setNearestDriverStore] = useState("Wairau Park");
  const [loadingNearest, setLoadingNearest] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    API.get("/orders?status=pending").then(r => setOrders(r.data.orders || []));
    API.get("/trucks").then(r => setTrucks(r.data));
    API.get("/drivers").then(r => setDrivers(r.data));
    loadPlans();
  };

  const loadPlans = () => {
    API.get("/route-plans").then(r => setPlans(r.data));
  };

  const toggleOrder = (id) => {
    setSelectedOrders(prev => {
      const newOrders = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Auto-trigger recommendations if any orders selected
      if (newOrders.length > 0) {
        getTruckRecommendations(newOrders);
      } else {
        setRecommendations([]);
      }
      return newOrders;
    });
  };

  // Fuel Cost Route Optimization Recommendation
  const getTruckRecommendations = async (orderIds) => {
    setLoadingRecommendations(true);
    try {
      const res = await API.post("/route-plan/recommend-truck", { order_ids: orderIds });
      setRecommendations(res.data.recommendations || []);
    } catch (e) {
      console.error("Failed to fetch recommendations:", e);
    }
    setLoadingRecommendations(false);
  };

  const applyRecommendation = (rec) => {
    setTruckId(rec.truck_id);
    if (rec.driver_id) {
      setDriverId(rec.driver_id);
    }
  };

  // Find Nearest Driver for Add-on Job
  const findNearestDriver = async () => {
    setLoadingNearest(true);
    setNearestDriver(null);
    try {
      const res = await API.get(`/nearest-driver?store=${nearestDriverStore}`);
      setNearestDriver(res.data);
    } catch (e) {
      alert("Failed: " + e.message);
    }
    setLoadingNearest(false);
  };

  const createPlan = async () => {
    if (selectedOrders.length === 0) return alert("Select at least one order");
    if (!truckId || !driverId) return alert("Select truck and driver");
    try {
      const res = await API.post("/route-plan", {
        order_ids: selectedOrders,
        truck_id: truckId,
        driver_id: driverId,
        offsider_ids: selectedOffsiders,
        date,
        start_store: startStore,
      });
      setPlanResult(res.data);
      setSelectedOrders([]);
      setSelectedOffsiders([]);
      setRecommendations([]);
      loadInitialData();
    } catch (e) { alert("Failed: " + e.message); }
  };

  const sendWhatsApp = async (planId) => {
    try {
      await API.post(`/route-plans/${planId}/send-whatsapp`);
      alert("Route update sent via WhatsApp to group & driver!");
      loadPlans();
    } catch (e) { alert("Failed: " + e.message); }
  };

  const moveStop = (stops, idx, dir) => {
    if (dir === "up" && idx === 0) return stops;
    if (dir === "down" && idx === stops.length - 1) return stops;
    const newStops = [...stops];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [newStops[idx], newStops[swapIdx]] = [newStops[swapIdx], newStops[idx]];
    return newStops;
  };

  const saveReorder = async (plan) => {
    try {
      await API.put(`/route-plans/${plan.id}/reorder`, { stops: plan.stops });
      alert("Route stops and metrics updated successfully!");
      loadPlans();
    } catch (e) { alert("Failed: " + e.message); }
  };

  const toggleOffsider = (id) => {
    setSelectedOffsiders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const onlyDrivers = drivers.filter(d => d.role === "driver");
  const onlyOffsiders = drivers.filter(d => d.role === "offsider");

  return (
    <div className="max-w-6xl mx-auto space-y-6 selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 shadow-2xl text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MapPin size={22} className="text-blue-400" /> Route Optimizer & Planner
        </h2>
        <span className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-bold uppercase tracking-wider">Auto Fuel TSP Logic</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Select Orders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800 p-5 relative overflow-hidden group">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Compass size={18} className="text-blue-400" /> 1. Select Orders
            </h3>
            {orders.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center font-medium">No pending orders available for routing.</p>
            ) : (
              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                 {orders.map(o => (
                  <div key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedOrders.includes(o.id) 
                      ? "bg-blue-500/10 border-blue-500/50 shadow-md shadow-blue-500/5" 
                      : "border-slate-800 bg-slate-900/30 hover:bg-slate-900/60 hover:border-slate-700"
                  }`} onClick={() => toggleOrder(o.id)}>
                    <input type="checkbox" checked={selectedOrders.includes(o.id)} readOnly className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950 pointer-events-none" />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-250">{o.invoiceNo || "Not identified"}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                          o.bt_type === "customer_delivery" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          (o.bt_type === "branch_transfer" || (o.bt_type && o.bt_type.toLowerCase().includes("goods"))) ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          o.bt_type === "return_to_store" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                          "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}>
                          {(o.bt_type === "branch_transfer" || (o.bt_type && o.bt_type.toLowerCase().includes("goods"))) ? "BT Branch Transfer" : o.bt_type?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-1 truncate">{o.bt_order_type ? `${o.bt_order_type} · ${o.destination || "Not identified"}` : o.destination || "Not identified"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optimizer Recommendations */}
          {selectedOrders.length > 0 && (
            <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800 p-5 relative overflow-hidden group">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Truck size={18} className="text-emerald-500" /> Fuel-Optimization Recommendations
              </h3>
              {loadingRecommendations ? (
                <p className="text-sm text-slate-400 py-2">Calculating lowest fuel cost routes...</p>
              ) : recommendations.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No active trucks available for recommendation.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">Trucks sorted by distance to selected orders (closest first saves fuel cost):</p>
                  {recommendations.map((rec, i) => (
                    <div key={rec.truck_id} className={`flex justify-between items-center p-3 rounded-xl border text-sm ${
                      i === 0 
                        ? "border-emerald-500/40 bg-emerald-500/5" 
                        : "border-slate-800 bg-slate-900/20"
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">🚛 {rec.license_plate || rec.truck_id}</span>
                          {i === 0 && <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Best Choice</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Driver: <span className="text-slate-300 font-medium">{rec.driver_name}</span> | Distance: <span className="text-slate-300 font-semibold">{rec.distance_to_centroid_km} km</span></p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-extrabold text-emerald-400 text-base">${rec.estimated_activation_fuel_cost}</p>
                          <p className="text-[9px] text-slate-500 uppercase font-semibold">Est. activation fuel</p>
                        </div>
                        <button onClick={() => applyRecommendation(rec)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-all">Apply</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Plan Settings */}
        <div className="space-y-6">
          <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800 p-5 space-y-4 text-slate-300">
            <h3 className="font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Users size={18} className="text-indigo-400" /> 2. Roster & Date
            </h3>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Start Store / Origin</label>
              <select className="w-full border border-slate-700/80 rounded-xl px-3 py-2 text-sm bg-slate-900 text-slate-200 outline-none focus:border-blue-500" value={startStore} onChange={e => setStartStore(e.target.value)}>
                {["Wairau Park", "Albany", "Westgate", "Hastings", "Palmerston North", "Hamilton", "Whanganui", "Whakatane", "Lower Hutt", "Whangarei"].map(s => (
                  <option key={s} value={s} className="bg-slate-950 text-slate-200">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Assigned Truck</label>
              <select className="w-full border border-slate-700/80 rounded-xl px-3 py-2 text-sm bg-slate-900 text-slate-200 outline-none focus:border-blue-500" value={truckId} onChange={e => setTruckId(e.target.value)}>
                <option value="" className="bg-slate-950 text-slate-400">Select a truck...</option>
                {trucks.map(t => <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200">{t.license_plate || t.id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Primary Driver</label>
              <select className="w-full border border-slate-700/80 rounded-xl px-3 py-2 text-sm bg-slate-900 text-slate-200 outline-none focus:border-blue-500" value={driverId} onChange={e => setDriverId(e.target.value)}>
                <option value="" className="bg-slate-950 text-slate-400">Select a driver...</option>
                {onlyDrivers.map(d => <option key={d.id} value={d.id} className="bg-slate-950 text-slate-200">{d.name} {d.is_online ? "🟢" : "🔴"}</option>)}
              </select>
            </div>
            
            {/* Offsider assignment list */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Offsiders (Helpers)</label>
              <div className="border border-slate-800 rounded-xl p-3 max-h-[120px] overflow-y-auto space-y-1.5 bg-slate-900/30">
                {onlyOffsiders.length === 0 ? (
                  <p className="text-xs text-slate-500 p-1">No offsiders rostered</p>
                ) : (
                  onlyOffsiders.map(o => (
                    <label key={o.id} className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer hover:bg-slate-800/40 p-1.5 rounded-lg transition-all">
                      <input type="checkbox" checked={selectedOffsiders.includes(o.id)} onChange={() => toggleOffsider(o.id)} className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-950" />
                      <span>{o.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Route Date</label>
              <input type="date" className="w-full border border-slate-700/80 rounded-xl px-3 py-2 text-sm bg-slate-900 text-slate-200 outline-none focus:border-blue-500 [color-scheme:dark]" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button onClick={createPlan} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/10">
              <Plus size={15} /> Create Optimized Route
            </button>
          </div>

          {/* Add-on Dispatch / Nearest Driver */}
          <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800 p-5 space-y-3">
            <h3 className="font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Compass size={18} className="text-amber-500" /> Find Nearest Driver (Add-on Jobs)
            </h3>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Add-on Job Store</label>
              <div className="flex gap-2">
                <select className="flex-1 border border-slate-700/80 rounded-xl px-3 py-1.5 text-sm bg-slate-900 text-slate-200 outline-none focus:border-blue-500" value={nearestDriverStore} onChange={e => setNearestDriverStore(e.target.value)}>
                  {["Wairau Park", "Albany", "Westgate", "Hastings", "Palmerston North", "Hamilton", "Whanganui", "Whakatane", "Lower Hutt", "Whangarei"].map(s => (
                    <option key={s} value={s} className="bg-slate-950 text-slate-200">{s}</option>
                  ))}
                </select>
                <button onClick={findNearestDriver} disabled={loadingNearest} className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/10">
                  {loadingNearest ? "..." : "Search"}
                </button>
              </div>
            </div>
            
            {nearestDriver && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs space-y-1.5">
                {nearestDriver.message ? (
                  <p className="text-amber-400 text-center font-bold">{nearestDriver.message}</p>
                ) : (
                  <>
                    <p className="font-extrabold text-amber-300 text-sm">👤 {nearestDriver.name}</p>
                    <p className="text-slate-300">Role: <span className="font-medium">{nearestDriver.role}</span> | {nearestDriver.phone}</p>
                    <p className="text-slate-300">Truck Plate: <span className="font-mono text-slate-200">{nearestDriver.license_plate || "N/A"}</span></p>
                    {nearestDriver.current_lat && (
                      <p className="text-amber-400/80 font-mono mt-1">📍 Coords: {nearestDriver.current_lat.toFixed(4)}, {nearestDriver.current_lon.toFixed(4)}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Route Plan Result */}
      {planResult && (
        <div className="bg-slate-950/40 rounded-2xl shadow-xl p-5 border border-blue-500/20 animate-fade-in space-y-4">
          <h3 className="font-extrabold text-blue-400 flex items-center gap-2 text-lg">🎉 Optimized Route Plan Created!</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-3 py-1 rounded-md">📏 Distance: {planResult.plan.total_distance_km} km</span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-3 py-1 rounded-md">⛽ Est. Fuel: ${planResult.plan.estimated_fuel_cost}</span>
            <span className="bg-slate-800 text-slate-300 border border-slate-700 font-bold px-3 py-1 rounded-md">🚛 Truck: {planResult.plan.truck_id}</span>
          </div>
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm font-semibold text-emerald-300">
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">START</span>
              <span>Harvey Norman {planResult.start_point.name}</span>
            </div>
            {planResult.plan.stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-900/30 border border-slate-800 rounded-xl text-sm text-slate-200">
                <span className="bg-blue-600 text-white font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs">{i + 1}</span>
                <span className="flex-1 font-semibold">{stop.location || stop.address || stop.name || "Unknown"}</span>
                <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">{stop.order_number || "Add-on stop"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Route Plans List */}
      <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800/80 p-5">
        <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2">📋 Saved Route Plans</h3>
        {plans.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">No route plans generated yet.</p>
        ) : (
          <div className="space-y-6">
            {plans.map(plan => {
              const driverObj = drivers.find(d => d.id === plan.driver_id);
              const planOffsiders = drivers.filter(d => (plan.offsider_ids || []).includes(d.id)).map(d => d.name).join(", ");
              return (
                <div key={plan.id} className="border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/50 transition-all space-y-4 bg-slate-900/10">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="text-sm space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-blue-400">{plan.date}</span>
                        <span className="text-slate-700">|</span>
                        <span className="font-semibold text-slate-200">🚛 Truck: {plan.truck_id}</span>
                        <span className="text-slate-700">|</span>
                        <span className="text-slate-300 font-medium">Driver: <span className="text-slate-200 font-bold">{driverObj?.name || "N/A"}</span></span>
                      </div>
                      {(plan.offsider_ids || []).length > 0 && (
                        <p className="text-xs text-slate-400">Helpers (Offsiders): <span className="font-semibold text-indigo-300">{planOffsiders}</span></p>
                      )}
                      <div className="flex gap-3 text-xs mt-1 text-slate-400">
                        <span className="flex items-center gap-1">📏 {plan.total_distance_km} km</span>
                        <span className="text-slate-700">•</span>
                        <span className="flex items-center gap-1 font-semibold text-emerald-400">⛽ Est. Fuel: ${plan.estimated_fuel_cost}</span>
                      </div>
                    </div>
                    <button onClick={() => sendWhatsApp(plan.id)} disabled={plan.whatsapp_sent} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/10 disabled:opacity-50">
                      <Send size={13} /> {plan.whatsapp_sent ? "Sent to WhatsApp" : "Send Next-Day Plan"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {plan.stops.map((stop, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm bg-slate-900/30 p-3 rounded-xl border border-slate-800/60 shadow-inner">
                        <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs">{i + 1}</span>
                        <span className="flex-1 text-slate-200 font-medium">{stop.location || stop.address || stop.name || "Unknown"}</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { const reordered = moveStop(plan.stops, i, "up"); plan.stops = reordered; setPlans([...plans]); }} className="text-slate-500 hover:text-indigo-400 p-1 bg-slate-950/30 border border-slate-800 rounded-md transition-all"><ArrowUp size={13} /></button>
                          <button onClick={() => { const reordered = moveStop(plan.stops, i, "down"); plan.stops = reordered; setPlans([...plans]); }} className="text-slate-500 hover:text-indigo-400 p-1 bg-slate-950/30 border border-slate-800 rounded-md transition-all"><ArrowDown size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => saveReorder(plan)} className="mt-1 text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-all bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                    <Save size={13} /> Save Order Changes
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
