import React, { useState, useEffect, useMemo } from "react";
import API from "../services/api";
import { format } from "date-fns";
import { Search, Download, RefreshCw, FileText, Eye, CheckCircle, Circle, ArrowUpRight, TrendingUp, Upload, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

export default function Dashboard({ onSelectOrder }) {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBT, setFilterBT] = useState("");
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [metrics, setMetrics] = useState({ total: 0, pickedUp: 0, delivered: 0, pending: 0 });

  // Reload when filters change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders(1);
      loadMetrics();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterStatus, filterBT]);

  const loadOrders = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterStatus) params.append("status", filterStatus);
      if (filterBT) params.append("bt_type", filterBT);
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

  const handleExportPDF = () => {
    window.open("http://localhost:5000/api/dashboard/export/pdf", "_blank");
  };

  const handleExportExcel = () => {
    window.open("http://localhost:5000/api/dashboard/export/excel", "_blank");
  };

  const handleStatusToggle = async (order, field) => {
    try {
      await API.patch(`/orders/${order.id}/status`, { [field]: !order[field] });
      loadOrders(pagination.page);
      loadMetrics();
    } catch (e) {
      alert("Update failed: " + e.message);
    }
  };

  const handleDeleteOrder = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await API.delete(`/orders/${id}`);
      loadOrders(pagination.page);
      loadMetrics();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const formatProducts = (items) => {
    if (!items || !items.length) return "—";
    return items.map((i) => `${i.sku} x${i.quantity}`).join(", ");
  };

  const formatDate = (d) => {
    if (!d) return "—";
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

          <select 
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer focus:border-blue-500" 
            value={filterBT} 
            onChange={(e) => setFilterBT(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="customer_delivery">Customer Delivery</option>
            <option value="branch_transfer">Branch Transfer</option>
            <option value="goods_movement">Goods Movement</option>
            <option value="purchase_order">Purchase Order</option>
            <option value="return_to_store">Return to Store</option>
          </select>
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
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Email Date</th>
                <th className="px-4 py-3 text-left">Products</th>
                <th className="px-4 py-3 text-left">BT Type</th>
                <th className="px-4 py-3 text-left">BT From</th>
                <th className="px-4 py-3 text-left">BT To</th>
                <th className="px-4 py-3 text-left">Billing Party</th>
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
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Syncing database...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
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
                      {order.invoice_number || "—"}
                    </td>
                    <td className="px-4 py-3.5 max-w-[150px] truncate text-slate-300 text-xs" title={order.email_subject}>
                      {order.email_subject || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-xs">
                      {formatDate(order.email_date)}
                    </td>
                    <td className="px-4 py-3.5 max-w-[150px] truncate text-slate-400 text-xs" title={formatProducts(order.line_items)}>
                      {formatProducts(order.line_items)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                        order.bt_type === "customer_delivery" ? "bg-blue-950/40 text-blue-400 border-blue-500/20" :
                        order.bt_type === "goods_movement" ? "bg-amber-950/40 text-amber-400 border-amber-500/20" :
                        order.bt_type === "purchase_order" ? "bg-purple-950/40 text-purple-400 border-purple-500/20" :
                        order.bt_type === "return_to_store" ? "bg-red-950/40 text-red-400 border-red-500/20" :
                        "bg-slate-900 text-slate-400 border-slate-800"
                      }`}>
                        {order.bt_type?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs truncate max-w-[100px]" title={order.bt_from}>
                      {order.bt_from || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs truncate max-w-[100px]" title={order.bt_to}>
                      {order.bt_to || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-xs truncate max-w-[120px]" title={order.billing_party}>
                      {order.billing_party || "—"}
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
                    
                    <td className="px-4 py-3.5 font-semibold text-emerald-400 font-mono text-xs">
                      {order.rate ? `$${order.rate.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 max-w-[140px] truncate text-slate-400 text-xs" title={order.location}>
                      {order.location || "—"}
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
