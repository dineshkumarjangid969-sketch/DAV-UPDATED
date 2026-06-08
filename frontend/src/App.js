import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import OrderDetail from "./components/OrderDetail";
import RoutePlanner from "./components/RoutePlanner";
import Settings from "./components/Settings";
import LiveMap from "./components/LiveMap";
import Roster from "./components/Roster";
import RosterPlanner from "./components/RosterPlanner";
import Notifications from "./components/Notifications";
import API from "./services/api";
import { Truck, Settings as SettingsIcon, Map, BarChart3, AlertCircle, Calendar, MessageSquare, Navigation } from "lucide-react";

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = () => {
    API.get("/health")
      .then(r => setHealth(r.data))
      .catch(() => setHealth({ status: "error" }));
  };

  const views = {
    dashboard: <Dashboard onSelectOrder={(o) => { setSelectedOrder(o); setView("detail"); }} />,
    detail: <OrderDetail order={selectedOrder} onBack={() => setView("dashboard")} />,
    route: <RoutePlanner />,
    roster_planner: <RosterPlanner />,
    map: <LiveMap />,
    roster: <Roster />,
    notifications: <Notifications />,
    settings: <Settings />,
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Premium Header */}
      <nav className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 p-2 rounded-xl border border-blue-500/20 text-blue-400">
            <Truck size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              DAV Transport <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Control</span>
            </h1>
            <p className="text-[10px] text-slate-400">Delivery Management System</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800 gap-1 flex-wrap">
          <button 
            onClick={() => setView("dashboard")} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              view === "dashboard" || view === "detail" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <BarChart3 size={15} /> Dashboard
          </button>
          <button 
            onClick={() => setView("route")} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              view === "route" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Map size={15} /> Route Planner
          </button>
          <button 
            onClick={() => setView("map")} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              view === "map" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Navigation size={15} /> Live Map
          </button>

          <button 
            onClick={() => setView("roster")} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              view === "roster" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Calendar size={15} /> Roster
          </button>
          <button 
            onClick={() => setView("notifications")} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              view === "notifications" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <MessageSquare size={15} /> Notifications
          </button>
          <button 
            onClick={() => setView("settings")} 
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              view === "settings" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <SettingsIcon size={15} /> Settings
          </button>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-2">
          {health?.status === "ok" ? (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
              <AlertCircle size={12} className="animate-pulse" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="transition-all duration-300">
          {views[view]}
        </div>
      </main>
    </div>
  );
}
