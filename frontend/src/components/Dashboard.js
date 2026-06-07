import React, { useState, useEffect, useMemo, useRef } from "react";
import API from "../services/api";
import { format } from "date-fns";
import { Search, Download, RefreshCw, FileText, Eye, CheckCircle, Circle, ArrowUpRight, TrendingUp, Upload, ChevronLeft, ChevronRight, Trash2, DollarSign, Check, X, Edit2 } from "lucide-react";

export default function Dashboard({ onSelectOrder }) {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrderType, setFilterOrderType] = useState("all");
  const [filterStore, setFilterStore] = useState("");
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [metrics, setMetrics] = useState({ total: 0, pickedUp: 0, delivered: 0, pending: 0 });
  const [editingRateId, setEditingRateId] = useState(null);
  const [editingRateValue, setEditingRateValue] = useState("");
  const rateInputRef = useRef(null);

  // Reload when filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders(1);
      loadMetrics();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterStatus, filterStore, filterOrderType]);

  const loadOrders = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterStatus) params.append("status", filterStatus);
      // no bt_type param is sent from UI (BT filtering removed)
      if (filterOrderType && filterOrderType !== "all") params.append("bt_order_type", filterOrderType);
      if (filterStore) params.append("store", filterStore);
      params.append("page", page);
      params.append("limit", 50);

      const res = await API.get(`/orders?${params.toString()}`);
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadMetrics = async () => {
    try {
      const res = await API.get("/dashboard");
      setMetrics({
        total: res.data.counts.total,
        pickedUp: res.data.counts.pickedUp,
        delivered: res.data.counts.delivered,
        pending: res.data.counts.pendingMetrics
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await API.post("/scan");
      loadOrders(1);
      loadMetrics();
    } catch (e) {
      alert("Scan failed: " + e.message);
    }
    setScanning(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("document", file);
    setUploading(true);

    try {
      await API.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      loadOrders(1);
      loadMetrics();
      alert("Document parsed and order created successfully!");
    } catch (err) {
      alert("Upload and Parsing failed: " + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      e.target.value = null; // reset input
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5000/api/dashboard/export/pdf`);
      if (!res.ok) throw new Error("Failed to export PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5000/api/dashboard/export/excel`);
      if (!res.ok) throw new Error("Failed to export Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleStatusToggle = async (order, field) => {
    try {
      await API.patch(`/orders/${encodeURIComponent(encodeURIComponent(order.id))}/status`, { [field]: !order[field] });
      await loadOrders(pagination.page);
      loadMetrics();
    } catch (e) {
      alert("Update failed: " + e.message);
    }
  };

  const handleDeleteOrder = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this order?")) return;
    try {
      await API.delete(`/orders/${encodeURIComponent(encodeURIComponent(id))}`);
      await loadOrders(pagination.page);
      loadMetrics();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleRateEdit = (e, order) => {
    e.stopPropagation();
    setEditingRateId(order.id);
    setEditingRateValue(order.rate != null ? order.rate.toFixed(2) : "");
    setTimeout(() => rateInputRef.current?.focus(), 50);
  };

  const handleRateSave = async (e, orderId) => {
    if (e) e.stopPropagation();
    try {
      const val = editingRateValue.trim();
      await API.patch(`/orders/${encodeURIComponent(encodeURIComponent(orderId))}/status`, {
        rate: val === "" ? null : parseFloat(val)
      });
      setEditingRateId(null);
      await loadOrders(pagination.page);
    } catch (err) {
      alert("Failed to update rate: " + err.message);
    }
  };

  const handleRateCancel = (e) => {
    if (e) e.stopPropagation();
    setEditingRateId(null);
    setEditingRateValue("");
  };

  const handleRateKeyDown = (e, orderId) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRateSave(e, orderId);
    } else if (e.key === "Escape") {
      handleRateCancel(e);
    }
  };

  const formatProducts = (items) => {
    if (!items || !items.length) return "Not identified";
    return items.map((i) => `${i.sku} x${i.quantity}`).join(", ");
  };

  const formatDate = (d) => {
    if (!d) return "Not identified";
    try {
      return format(new Date(d), "dd/MM/yyyy HH:mm");
    } catch {
      return d;
    }
  };


  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Total Orders", val: metrics.total, desc: "Scanned & logged", color: "from-blue-600 to-indigo-600" },
          { title: "Picked Up", val: metrics.pickedUp, desc: "En route / loaded", color: "from-amber-600 to-orange-600" },
          { title: "Delivered", val: metrics.delivered, desc: "Confirmed arrival", color: "from-green-600 to-emerald-600" },
          { title: "Pending", val: metrics.pending, desc: "Awaiting execution", color: "from-violet-600 to-fuchsia-600" },
        ].map((c, i) => (
          <div key={i} className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${c.color} opacity-10 blur-xl group-hover:opacity-20 transition-all rounded-full`}></div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{c.title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white">{c.val}</span>
              <span className="text-[10px] text-green-400 flex items-center"><TrendingUp size={10} className="mr-0.5" /> active</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/30 p-4 rounded-2xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Search Bar */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 flex-1 min-w-[200px] focus-within:border-blue-500 transition-all">
            <Search size={16} className="text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search order number, invoice, client..."
              className="outline-none bg-transparent text-sm w-full text-slate-200 placeholder:text-slate-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filters */}
          <select 
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer focus:border-blue-500" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Branch transfer filter removed per user request */}

          <select 
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer focus:border-blue-500" 
            value={filterOrderType} 
            onChange={(e) => setFilterOrderType(e.target.value)}
          >
            <option value="all">All Route Types</option>
            <option value="Local">Local</option>
            <option value="Line-Haul">Line-Haul</option>
            <option value="Line-Haul + Local">Line-Haul + Local</option>
            <option value="Not identified">Not identified</option>
          </select>

          <input 
            type="text" 
            placeholder="Filter by Store..."
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none w-36 focus:border-blue-500"
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleScan} 
            disabled={scanning} 
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/10"
          >
            <RefreshCw size={13} className={scanning ? "animate-spin" : ""} /> 
            {scanning ? "Scanning..." : "Scan Emails"}
          </button>
          <label className="bg-slate-900 hover:bg-slate-800 text-blue-400 border border-blue-500/25 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-md">
            <Upload size={13} className={uploading ? "animate-bounce" : ""} />
            {uploading ? "Parsing AI..." : "Upload Document"}
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpeg,.jpg,.docx" />
          </label>
          <button 
            onClick={handleExportPDF} 
            className="bg-slate-900 hover:bg-slate-800 text-red-400 border border-red-500/25 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <FileText size={13} /> PDF Report
          </button>
          <button 
            onClick={handleExportExcel} 
            className="bg-slate-900 hover:bg-slate-800 text-green-400 border border-green-500/25 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-950/40 rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-300 table-auto">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Order #</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Email Date</th>
                <th className="px-4 py-3 text-left">Products</th>
                <th className="px-4 py-3 text-left">BT Route Type</th>
                <th className="px-4 py-3 text-left">Coming From</th>
                <th className="px-4 py-3 text-left">Destination</th>
                <th className="px-4 py-3 text-left">Bill To</th>
                <th className="px-4 py-3 text-center">Picked up</th>
                <th className="px-4 py-3 text-center">Delivered</th>
                <th className="px-4 py-3 text-center">Billed</th>
                <th className="px-4 py-3 text-left">Rate</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Syncing database...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-slate-500">
                    No orders matched search criteria.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-slate-900/40 transition-colors cursor-pointer group"
                    onClick={() => onSelectOrder(order)}
                  >
                    <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">
                      {order.invoiceNo || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 font-mono text-xs text-indigo-400 font-bold">
                      {order.order_number || order.invoiceNo || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 max-w-[150px] truncate text-slate-300 text-xs" title={order.sourceEmailSubject}>
                      {order.sourceEmailSubject || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-xs">
                      {formatDate(order.email_date)}
                    </td>
                    <td className="px-4 py-3.5 max-w-[150px] truncate text-slate-400 text-xs" title={formatProducts(order.products)}>
                      {formatProducts(order.products)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs truncate max-w-[120px]" title={order.bt_order_type}>
                      {order.bt_order_type || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs truncate max-w-[100px]" title={order.comingFrom}>
                      {order.comingFrom || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs truncate max-w-[100px]" title={order.destination}>
                      {order.destination || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs truncate max-w-[120px]" title={order.billTo}>
                      {order.billTo || "Not identified"}
                    </td>
                    
                    {/* Status Toggles */}
                    <td className="px-4 py-3.5 text-center" onClick={(e) => { e.stopPropagation(); handleStatusToggle(order, "picked_up"); }}>
                      {order.picked_up ? (
                        <CheckCircle size={17} className="text-green-500 mx-auto drop-shadow-[0_0_4px_rgba(34,197,94,0.2)]" />
                      ) : (
                        <Circle size={17} className="text-slate-700 hover:text-slate-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center" onClick={(e) => { e.stopPropagation(); handleStatusToggle(order, "delivered"); }}>
                      {order.delivered ? (
                        <CheckCircle size={17} className="text-green-500 mx-auto drop-shadow-[0_0_4px_rgba(34,197,94,0.2)]" />
                      ) : (
                        <Circle size={17} className="text-slate-700 hover:text-slate-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center" onClick={(e) => { e.stopPropagation(); handleStatusToggle(order, "billed"); }}>
                      {order.billed ? (
                        <CheckCircle size={17} className="text-green-500 mx-auto drop-shadow-[0_0_4px_rgba(34,197,94,0.2)]" />
                      ) : (
                        <Circle size={17} className="text-slate-700 hover:text-slate-500 mx-auto" />
                      )}
                    </td>
                    
                    <td className="px-4 py-3.5 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                      {editingRateId === order.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-400">$</span>
                          <input
                            ref={rateInputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 bg-slate-800 border border-emerald-500/50 rounded-lg px-2 py-1 text-emerald-300 text-xs font-mono outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all"
                            value={editingRateValue}
                            onChange={(e) => setEditingRateValue(e.target.value)}
                            onKeyDown={(e) => handleRateKeyDown(e, order.id)}
                            onBlur={() => setTimeout(() => { if (editingRateId === order.id) handleRateCancel(); }, 200)}
                            placeholder="0.00"
                          />
                          <button
                            onClick={(e) => handleRateSave(e, order.id)}
                            className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded transition-colors"
                            title="Save (Enter)"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={handleRateCancel}
                            className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                            title="Cancel (Esc)"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleRateEdit(e, order)}
                          className="group/rate flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="Click to edit rate"
                        >
                          {order.rate != null ? `$${order.rate.toFixed(2)}` : "—"}
                          <Edit2 size={12} className="text-slate-600 group-hover/rate:text-emerald-400/60 transition-colors" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 max-w-[140px] truncate text-slate-400 text-xs" title={order.destination}>
                      {order.destination || "Not identified"}
                    </td>
                    <td className="px-4 py-3.5 text-center flex items-center justify-center gap-1.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelectOrder(order); }}
                        className="bg-slate-900 border border-slate-800 group-hover:border-blue-500/30 text-slate-400 hover:text-blue-400 p-1.5 rounded-lg transition-all"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteOrder(e, order.id)}
                        className="bg-slate-900 border border-slate-800 group-hover:border-rose-500/30 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg transition-all"
                        title="Delete Order"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-4 py-3 bg-slate-950/30 rounded-2xl border border-slate-800/80">
          <span className="text-xs text-slate-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => loadOrders(pagination.page - 1)} 
              disabled={pagination.page <= 1}
              className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="bg-slate-950 border border-slate-800/80 text-blue-400 font-semibold px-4 py-2 rounded-xl text-xs">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button 
              onClick={() => loadOrders(pagination.page + 1)} 
              disabled={pagination.page >= pagination.totalPages}
              className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
