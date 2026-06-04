import React, { useState, useEffect } from "react";
import API from "../services/api";
import { Plus, Trash2, Mail, Users, Truck, AlertTriangle, ShieldCheck } from "lucide-react";

export default function Settings() {
  const [accounts, setAccounts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [newAccount, setNewAccount] = useState({ email: "", host: "imap.gmail.com", port: 993, username: "", password: "", use_ssl: true });
  const [newDriver, setNewDriver] = useState({ name: "", email: "", phone: "", role: "driver", whatsapp_number: "" });
  const [newTruck, setNewTruck] = useState({ license_plate: "", capacity_cbm: 50 });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = () => {
    API.get("/email-accounts").then(r => setAccounts(r.data));
    API.get("/drivers").then(r => setDrivers(r.data));
    API.get("/trucks").then(r => setTrucks(r.data));
  };

  const addAccount = async () => {
    if (!newAccount.email || !newAccount.username || !newAccount.password) {
      return alert("Please fill in email, username, and app password.");
    }
    try { 
      await API.post("/email-accounts", newAccount); 
      setNewAccount({ email: "", host: "imap.gmail.com", port: 993, username: "", password: "", use_ssl: true }); 
      loadAll(); 
    } catch (e) { 
      alert("Failed: " + e.message); 
    }
  };

  const deleteAccount = async (id) => {
    if (!window.confirm("Delete this email account?")) return;
    await API.delete(`/email-accounts/${id}`); 
    loadAll();
  };

  const addDriver = async () => {
    if (!newDriver.name || !newDriver.phone) {
      return alert("Please fill in name and phone.");
    }
    try { 
      await API.post("/drivers", newDriver); 
      setNewDriver({ name: "", email: "", phone: "", role: "driver", whatsapp_number: "" }); 
      loadAll(); 
    } catch (e) { 
      alert("Failed: " + e.message); 
    }
  };

  const deleteDriver = async (id) => {
    if (!window.confirm("Delete this roster record?")) return;
    await API.delete(`/drivers/${id}`); 
    loadAll();
  };

  const addTruck = async () => {
    if (!newTruck.license_plate) {
      return alert("Please enter truck license plate.");
    }
    try { 
      await API.post("/trucks", newTruck); 
      setNewTruck({ license_plate: "", capacity_cbm: 50 }); 
      loadAll(); 
    } catch (e) { 
      alert("Failed: " + e.message); 
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black text-white tracking-tight">System Settings</h2>
        <p className="text-slate-400 text-xs mt-1">Configure email parsing sources, drivers/offsiders database, and truck assets.</p>
      </div>

      {/* Gmail Accounts */}
      <div className="bg-slate-950/40 rounded-2xl shadow border border-slate-800/80 p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
          <Mail size={17} className="text-blue-400" /> Email Sync Accounts (Dual Gmail Support)
        </h3>
        
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center bg-slate-900/10 rounded-lg border border-dashed border-slate-800">No Gmail accounts synced yet. Sync up to 2 Gmail accounts below.</p>
          ) : (
            accounts.map(a => (
              <div key={a.id} className="flex justify-between items-center p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-100">{a.email}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 font-mono">{a.host}:{a.port}</span>
                  <span className="text-slate-600">|</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {a.is_active ? "Active Scanner" : "Inactive"}
                  </span>
                </div>
                <button onClick={() => deleteAccount(a.id)} className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-lg transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Account Form */}
        <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/60 space-y-3">
          <p className="text-xs font-semibold text-slate-300">Add New Gmail Account</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input 
              placeholder="Gmail Address" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500" 
              value={newAccount.email} 
              onChange={e => setNewAccount({...newAccount, email: e.target.value})} 
            />
            <input 
              placeholder="IMAP Host (imap.gmail.com)" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500" 
              value={newAccount.host} 
              onChange={e => setNewAccount({...newAccount, host: e.target.value})} 
            />
            <input 
              placeholder="Port (993)" 
              type="number" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500" 
              value={newAccount.port} 
              onChange={e => setNewAccount({...newAccount, port: parseInt(e.target.value) || 993})} 
            />
            <input 
              placeholder="Username / Email" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500" 
              value={newAccount.username} 
              onChange={e => setNewAccount({...newAccount, username: e.target.value})} 
            />
            <input 
              placeholder="Gmail App Password" 
              type="password" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-blue-500" 
              value={newAccount.password} 
              onChange={e => setNewAccount({...newAccount, password: e.target.value})} 
            />
            <button 
              onClick={addAccount} 
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-bold transition-all flex items-center justify-center gap-1.5 shadow"
            >
              <Plus size={14} /> Add Sync Source
            </button>
          </div>
          <div className="flex items-start gap-2 mt-2 text-[10px] text-slate-400 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p>Gmail accounts require enabling IMAP in Mail Settings and generating an **App Password** via Google Account Security (2FA required). Regular password login will be rejected by Google.</p>
          </div>
        </div>
      </div>

      {/* Roster crew (Drivers & Offsiders) */}
      <div className="bg-slate-950/40 rounded-2xl shadow border border-slate-800/80 p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
          <Users size={17} className="text-indigo-400" /> Drivers & Offsiders (Roster Management)
        </h3>
        
        <div className="space-y-2">
          {drivers.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center bg-slate-900/10 rounded-lg border border-dashed border-slate-800">No crew rostered yet.</p>
          ) : (
            drivers.map(d => (
              <div key={d.id} className="flex justify-between items-center p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl text-xs border-l-4 border-blue-500">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-100">{d.name}</span>
                  <span className="text-slate-600">|</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.role === "driver" ? "bg-blue-950/50 text-blue-400 border border-blue-500/20" : "bg-teal-950/50 text-teal-400 border border-teal-500/20"}`}>{d.role}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 font-medium">Ph: {d.phone}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 font-medium">WhatsApp: {d.whatsapp_number || "—"}</span>
                  <span className="text-slate-600">|</span>
                  <span className={`font-semibold ${d.is_online ? "text-green-400" : "text-slate-500"}`}>
                    {d.is_online ? "🟢 Active/Online" : "🔴 Offline"}
                  </span>
                  {d.current_lat && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-xs font-mono text-slate-400">📍 {d.current_lat.toFixed(4)}, {d.current_lon.toFixed(4)}</span>
                    </>
                  )}
                </div>
                <button onClick={() => deleteDriver(d.id)} className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-lg transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Driver Form */}
        <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/60 space-y-3">
          <p className="text-xs font-semibold text-slate-300">Roster New Member</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <input 
              placeholder="Name" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500" 
              value={newDriver.name} 
              onChange={e => setNewDriver({...newDriver, name: e.target.value})} 
            />
            <input 
              placeholder="Phone" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500" 
              value={newDriver.phone} 
              onChange={e => setNewDriver({...newDriver, phone: e.target.value})} 
            />
            <select 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none cursor-pointer focus:border-indigo-500" 
              value={newDriver.role} 
              onChange={e => setNewDriver({...newDriver, role: e.target.value})}
            >
              <option value="driver">Driver</option>
              <option value="offsider">Offsider</option>
            </select>
            <input 
              placeholder="WhatsApp (+64...)" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500" 
              value={newDriver.whatsapp_number} 
              onChange={e => setNewDriver({...newDriver, whatsapp_number: e.target.value})} 
            />
            <input 
              placeholder="Email Address" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-indigo-500 md:col-span-2" 
              value={newDriver.email} 
              onChange={e => setNewDriver({...newDriver, email: e.target.value})} 
            />
            <button 
              onClick={addDriver} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-bold transition-all flex items-center justify-center gap-1.5 shadow md:col-span-2"
            >
              <Plus size={14} /> Add Crew Roster
            </button>
          </div>
        </div>
      </div>

      {/* Trucks Asset List */}
      <div className="bg-slate-950/40 rounded-2xl shadow border border-slate-800/80 p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
          <Truck size={17} className="text-amber-400" /> Active Truck Assets
        </h3>
        
        <div className="space-y-2">
          {trucks.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center bg-slate-900/10 rounded-lg border border-dashed border-slate-800">No trucks registered.</p>
          ) : (
            trucks.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl text-xs border-l-4 border-amber-500">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-slate-100">🚛 {t.license_plate || t.id}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 font-medium">Capacity: {t.capacity_cbm} cbm</span>
                  <span className="text-slate-600">|</span>
                  <span className={`font-semibold ${t.is_online ? "text-green-400" : "text-slate-500"}`}>
                    {t.is_online ? "🟢 Active" : "🔴 Parked"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Truck Form */}
        <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/60 space-y-3">
          <p className="text-xs font-semibold text-slate-300">Register New Truck</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input 
              placeholder="License Plate" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" 
              value={newTruck.license_plate} 
              onChange={e => setNewTruck({...newTruck, license_plate: e.target.value})} 
            />
            <input 
              placeholder="Volume Capacity (cbm)" 
              type="number" 
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-amber-500" 
              value={newTruck.capacity_cbm} 
              onChange={e => setNewTruck({...newTruck, capacity_cbm: parseFloat(e.target.value) || 50})} 
            />
            <button 
              onClick={addTruck} 
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 font-bold transition-all flex items-center justify-center gap-1.5 shadow"
            >
              <Plus size={14} /> Register Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
