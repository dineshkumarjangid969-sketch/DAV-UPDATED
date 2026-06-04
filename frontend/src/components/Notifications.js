import React, { useState, useEffect } from "react";
import API from "../services/api";
import { MessageSquare, Send, CheckCircle, AlertCircle, RefreshCw, Smartphone, MessageCircle } from "lucide-react";

export default function Notifications() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const [tab, setTab] = useState("sms"); // sms or whatsapp

  const quickTemplates = [
    "Your roster shifts for next week are ready. Please review and confirm receipt.",
    "New delivery route assigned. Check the Control Centre for manifest updates.",
    "URGENT: Route change updated. Check new order locations.",
    "Reminder: Assembly required for these items. Ensure you have tools ready.",
    "Daily briefing: Check your assigned truck and route before departure.",
  ];

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const res = await API.get("/drivers");
      setDrivers(res.data || []);
    } catch (e) {
      console.error("Failed to load drivers:", e);
    }
    setLoading(false);
  };

  const handleSelectAll = () => {
    if (selectedDrivers.length === drivers.length) {
      setSelectedDrivers([]);
    } else {
      setSelectedDrivers(drivers.map(d => d.id));
    }
  };

  const toggleDriver = (id) => {
    setSelectedDrivers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSendSMS = async () => {
    if (!message.trim() || selectedDrivers.length === 0) return;
    setSending(true);
    setApiResult(null);

    try {
      const res = await API.post("/sms/bulk", {
        driver_ids: selectedDrivers,
        message: message.trim()
      });
      setApiResult({
        type: "success",
        text: `Sent SMS updates successfully to ${res.data.sent || 0} driver(s).`
      });
      setMessage("");
      setSelectedDrivers([]);
    } catch (e) {
      setApiResult({
        type: "error",
        text: "Failed to dispatch SMS alerts: " + (e.response?.data?.error || e.message)
      });
    }
    setSending(false);
  };

  const handleSendWhatsApp = () => {
    if (!message.trim()) return;
    
    if (selectedDrivers.length === 1) {
      // Direct WhatsApp link
      const driver = drivers.find(d => d.id === selectedDrivers[0]);
      if (driver && driver.phone) {
        const phone = driver.phone.replace(/[^0-9]/g, ""); // remove plus/spaces
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`, "_blank");
      } else {
        alert("Selected driver does not have a phone number.");
      }
    } else {
      // General WhatsApp web sharing link
      window.open(`https://wa.me/?text=${encodeURIComponent(message.trim())}`, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 shadow-2xl text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare size={22} className="text-blue-400" /> Notifications Composer
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("sms")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              tab === "sms" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Smartphone size={13} /> SMS / Text
          </button>
          <button
            onClick={() => setTab("whatsapp")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              tab === "whatsapp" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <MessageCircle size={13} /> WhatsApp
          </button>
        </div>
      </div>

      {apiResult && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
          apiResult.type === "success" 
            ? "bg-green-500/10 border-green-500/20 text-green-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {apiResult.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{apiResult.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Center Panel: Compose & Presets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Editor */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider text-[11px]">Compose Message</h3>
            
            <textarea
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all resize-none h-[140px]"
              placeholder="Type your message to drivers here..."
              value={message}
              onChange={(e) => setMessage(e.target.value.substring(0, 320))}
            />
            
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>{message.length} / 320 characters</span>
              <span>{selectedDrivers.length} recipient(s) selected</span>
            </div>

            <div className="pt-2">
              {tab === "sms" ? (
                <button
                  onClick={handleSendSMS}
                  disabled={sending || !message.trim() || selectedDrivers.length === 0}
                  className="bg-blue-600 text-white w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg text-xs"
                >
                  {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  Send Bulk SMS Broadcast
                </button>
              ) : (
                <button
                  onClick={handleSendWhatsApp}
                  disabled={!message.trim() || selectedDrivers.length === 0}
                  className="bg-emerald-600 text-white w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg text-xs"
                >
                  <MessageCircle size={14} />
                  Send via WhatsApp web
                </button>
              )}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider text-[11px]">⚡ Quick Message Templates</h3>
            <div className="space-y-2">
              {quickTemplates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => setMessage(template)}
                  className="w-full text-left bg-slate-900 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 p-3 rounded-xl text-xs text-slate-350 transition-all line-clamp-1"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Driver Selection List */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider text-[11px]">Recipients</h3>
            <button
              onClick={handleSelectAll}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
            >
              {selectedDrivers.length === drivers.length ? "Clear All" : "Select All"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {loading ? (
              <div className="text-center text-slate-500 py-12">
                <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-500" />
                Loading driver list...
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-center text-slate-500 py-12">No drivers found.</div>
            ) : (
              drivers.map(d => {
                const isSelected = selectedDrivers.includes(d.id);
                return (
                  <div
                    key={d.id}
                    onClick={() => toggleDriver(d.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-blue-500/10 border-blue-500/40 shadow-sm" 
                        : "border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-950 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-semibold text-white truncate">{d.name}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{d.phone || "No phone"} · {d.role}</div>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${d.is_online ? "bg-green-500" : "bg-slate-700"}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
