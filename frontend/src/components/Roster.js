import React, { useState, useEffect } from "react";
import API from "../services/api";
import { Calendar, RefreshCw, CheckCircle, AlertCircle, Send, Award } from "lucide-react";

export default function Roster() {
  const getNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  const [weekStart, setWeekStart] = useState(getNextMonday());
  const [drivers, setDrivers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState(null);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const getWeekDays = () => {
    return daysOfWeek.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [resDrivers, resRoster] = await Promise.all([
        API.get("/drivers"),
        API.get("/roster")
      ]);
      setDrivers(resDrivers.data || []);
      setShifts(resRoster.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [weekStart]);

  const handleGenerate = async () => {
    setGenerating(true);
    setNotificationMsg(null);
    try {
      const res = await API.post("/roster/generate", { week_start: weekStart });
      setShifts(res.data.shifts || []);
      setNotificationMsg({ type: "success", text: `Successfully generated ${res.data.shifts?.length || 0} shifts for week of ${weekStart}.` });
      loadData();
    } catch (e) {
      setNotificationMsg({ type: "error", text: "Generation failed: " + e.message });
    }
    setGenerating(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setNotificationMsg(null);
    try {
      const res = await API.post("/roster/publish");
      setNotificationMsg({ type: "success", text: `Roster published successfully! sent ${res.data.notifications_sent} SMS confirmations.` });
      loadData();
    } catch (e) {
      setNotificationMsg({ type: "error", text: "Publishing failed: " + e.message });
    }
    setPublishing(false);
  };

  const weekDays = getWeekDays();

  // Helper to color shift badges
  const getShiftBadgeStyle = (type) => {
    const maps = {
      morning: "bg-amber-950/40 text-amber-400 border-amber-500/20",
      afternoon: "bg-blue-950/40 text-blue-400 border-blue-500/20",
      night: "bg-violet-950/40 text-violet-400 border-violet-500/20",
      weekend: "bg-emerald-950/40 text-emerald-400 border-emerald-500/20",
      full_day: "bg-rose-950/40 text-rose-400 border-rose-500/20"
    };
    return maps[type] || "bg-slate-900 text-slate-400 border-slate-800";
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-wrap justify-between items-center bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 shadow-2xl text-white gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={22} className="text-blue-400" />
          <h2 className="text-xl font-bold">Driver Shift Roster</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Week Start:</span>
            <input
              type="date"
              className="bg-transparent text-sm text-slate-200 outline-none w-32"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg"
          >
            <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
            {generating ? "Generating..." : "Generate Weekly Shifts"}
          </button>

          {shifts.length > 0 && (
            <button
              onClick={handlePublish}
              disabled={publishing || loading}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg"
            >
              <Send size={13} />
              {publishing ? "Publishing..." : "Publish & Notify"}
            </button>
          )}
        </div>
      </div>

      {notificationMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
          notificationMsg.type === "success" 
            ? "bg-green-500/10 border-green-500/20 text-green-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {notificationMsg.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Roster Table */}
      <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-300 table-auto border-collapse">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 text-left w-48">Driver Name</th>
                {daysOfWeek.map((day, idx) => (
                  <th key={day} className="px-4 py-3 text-left min-w-[130px]">
                    <div>{day}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {weekDays[idx] ? new Date(weekDays[idx]).toLocaleDateString("en-NZ", { day: "numeric", month: "short" }) : ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Syncing shifts data...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No active drivers registered in the database.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="px-4 py-4 border-r border-slate-800/60">
                      <div className="font-semibold text-white text-xs">{driver.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 capitalize">{driver.role} · {driver.license_plate || "No truck"}</div>
                      
                      {/* Hours Utilization */}
                      <div className="mt-2.5 max-w-[140px]">
                        <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                          <span>Hours Utilization:</span>
                          <span className="font-semibold text-slate-350">{driver.current_hours || 0} / {driver.max_hours || 40}h</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1">
                          <div 
                            className={`h-1 rounded-full ${
                              (driver.current_hours || 0) > 35 ? "bg-red-500" : (driver.current_hours || 0) > 25 ? "bg-amber-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(((driver.current_hours || 0) / (driver.max_hours || 40)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {weekDays.map((dateStr) => {
                      const dayShifts = shifts.filter(s => s.driver_id === driver.id && s.date === dateStr);
                      return (
                        <td key={dateStr} className="px-3 py-3 vertical-top border-r border-slate-800/20">
                          {dayShifts.length === 0 ? (
                            <span className="text-[10px] text-slate-600 font-medium">Off Duty</span>
                          ) : (
                            dayShifts.map((shift) => (
                              <div key={shift.id} className={`p-2 rounded-lg border text-[10px] font-medium space-y-1.5 ${getShiftBadgeStyle(shift.shift_type)}`}>
                                <div className="flex justify-between items-center">
                                  <span className="font-bold uppercase tracking-wider text-[9px]">{shift.shift_type}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">{shift.start_time} - {shift.end_time}</span>
                                </div>
                                {shift.store_assignments && shift.store_assignments.length > 0 && (
                                  <div className="text-[9px] border-t border-slate-800/40 pt-1 text-slate-350 flex flex-wrap gap-1">
                                    {shift.store_assignments.map((store, sIdx) => (
                                      <span key={sIdx} className="bg-slate-950/40 px-1 py-0.5 rounded border border-slate-800 text-[8px]" title={store}>
                                        {store.replace("Harvey Norman ", "")}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roster Engine Information */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-2xl text-xs text-slate-400">
        <h3 className="font-bold text-white mb-2 flex items-center gap-1.5 text-sm">
          <Award size={15} className="text-blue-400" /> Weekly Shift Scheduling Parameters
        </h3>
        <p className="line-height-1.8">
          The weekly auto-scheduler assigns shifts to active drivers dynamically based on availability, maximum weekly working hours limits, and store assignment rotations.
          Draft schedules can be generated iteratively and will not trigger driver notifications until <strong>Publish & Notify</strong> is clicked, which dispatches confirmation alerts via text.
        </p>
      </div>
    </div>
  );
}
