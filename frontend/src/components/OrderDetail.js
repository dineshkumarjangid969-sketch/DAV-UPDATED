import React, { useState, useEffect } from "react";
import API from "../services/api";
import { ArrowLeft, Package, MapPin, FileText, Image as ImageIcon, Mail, CheckCircle, Circle, DollarSign, Clock } from "lucide-react";
import { format } from "date-fns";

export default function OrderDetail({ order, onBack }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!order?.id) return;
    API.get(`/orders/${order.id}`)
      .then((r) => {
        setDetails(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [order?.id]);

  const data = details || order;
  if (!data) return null;

  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd/MM/yyyy HH:mm");
    } catch {
      return d;
    }
  };

  const getFileUrl = (pathStr) => {
    if (!pathStr) return "";
    const parts = pathStr.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return `http://${window.location.hostname}:5000/uploads/${filename}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Button */}
      <button 
        onClick={onBack} 
        className="flex items-center gap-1 text-slate-400 hover:text-white transition-all text-xs uppercase tracking-wider font-semibold"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Main Details Panel */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-8">
        
        {/* Title Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black tracking-tight text-white">Order {data.invoiceNo || "Not identified"}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                data.status === "completed" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                data.status === "in_progress" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                "bg-slate-800 text-slate-400 border border-slate-700/30"
              }`}>
                {data.status}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              {data.invoiceNo && data.invoiceNo !== "Not identified" && `Invoice: ${data.invoiceNo}`}
              {data.po_number && ` | PO: ${data.po_number}`}
            </p>
          </div>
          {data.rate && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Delivery Rate</p>
              <p className="text-lg font-black text-emerald-400 font-mono">${data.rate.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order Metadata */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <Package size={16} className="text-blue-400" /> Logistics Details
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div>
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">BT Type</p>
                <p className="text-slate-200 mt-0.5 capitalize">{(data.bt_type === 'branch_transfer' || (data.bt_type && data.bt_type.toLowerCase().includes('goods'))) ? 'BT Branch Transfer' : data.bt_type === 'return_to_store' ? 'Return to Store' : data.bt_type === 'purchase_order' ? 'Purchase Order' : data.bt_type?.replace(/_/g, " ") || "Not identified"}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Bill To</p>
                <p className="text-slate-200 mt-0.5">{data.billTo || "Not identified"}</p>
              </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">BT Route Type</p>
                    <p className="text-slate-200 mt-0.5">{data.bt_order_type || "Not identified"}</p>
                  </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">BT Origin / Store</p>
                <p className="text-slate-200 mt-0.5">{data.comingFrom || "Not identified"}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">BT Destination</p>
                <p className="text-slate-200 mt-0.5">{data.destination || "Not identified"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Delivery Route Location</p>
                <p className="text-slate-200 mt-0.5 font-medium">{data.destination || "Not identified"}</p>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <MapPin size={16} className="text-orange-400" /> Delivery Info
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div className="col-span-2">
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Exact Address / Destination</p>
                <p className="text-slate-200 mt-0.5">{data.destination || "Not identified"}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">Preferred Delivery Date</p>
                <p className="text-slate-200 mt-0.5">{data.preferred_delivery_date || "Not identified"}</p>
              </div>
              <div className="flex items-center gap-4 col-span-2 mt-1 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                <span className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${data.requires_assembly ? "bg-blue-500" : "bg-slate-800"}`}></span>
                  <span className="text-[10px] text-slate-400">Assembly: {data.requires_assembly ? "Yes" : "No"}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${data.has_rubbish_removal ? "bg-green-500" : "bg-slate-800"}`}></span>
                  <span className="text-[10px] text-slate-400">Rubbish: {data.has_rubbish_removal ? "Yes" : "No"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-slate-900/20 border border-slate-800/60 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <Clock size={16} className="text-indigo-400" /> Delivery Status Tracking
          </h3>
          <div className="flex flex-wrap gap-8 justify-around p-2">
            {[
              { label: "Picked Up", done: data.picked_up, date: data.picked_up_at },
              { label: "Delivered", done: data.delivered, date: data.delivered_at },
              { label: "Billed", done: data.billed, date: data.billed_at },
            ].map((st, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`p-2 rounded-full border ${st.done ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-slate-900 border-slate-800 text-slate-600"}`}>
                  {st.done ? <CheckCircle size={22} className="drop-shadow-[0_0_4px_rgba(34,197,94,0.2)]" /> : <Circle size={22} />}
                </div>
                <div className="text-xs">
                  <p className={`font-bold ${st.done ? "text-slate-100" : "text-slate-500"}`}>{st.label}</p>
                  {st.done && st.date && <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(st.date)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Context Sources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <Mail size={16} className="text-blue-400" /> Original Email Source
            </h3>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 text-slate-500">From:</div>
                <div className="col-span-2 text-slate-300 font-medium">{data.email_from || "Not identified"}</div>
                
                <div className="col-span-1 text-slate-500">Subject:</div>
                <div className="col-span-2 text-slate-300 font-semibold">{data.sourceEmailSubject || "Not identified"}</div>
                
                <div className="col-span-1 text-slate-500">Date Received:</div>
                <div className="col-span-2 text-slate-400">{formatDate(data.email_date)}</div>

                <div className="col-span-1 text-slate-500">Docling Confidence:</div>
                <div className="col-span-2">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    data.confidence >= 0.8 ? "bg-green-500/10 text-green-400" :
                    data.confidence >= 0.5 ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {(data.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {data.email_screenshot_path && (
                <div className="pt-2">
                  <a 
                    href={getFileUrl(data.email_screenshot_path)} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline font-bold"
                  >
                    <FileText size={14} /> Open Saved Email Screenshot (.eml)
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Instructions */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <FileText size={16} className="text-violet-400" /> Delivery Instructions
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/40 p-3 rounded-xl border border-slate-900">
              {data.delivery_instructions || "No special instructions provided."}
            </p>
          </div>
        </div>

        {/* Product Items Table */}
        {data.products && data.products.length > 0 && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <Package size={16} className="text-emerald-400" /> Items List ({data.products.length})
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950/50 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">SKU / Code</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {data.products.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-900/10">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400">{item.sku}</td>
                      <td className="px-4 py-3 text-slate-300">{item.description || "Not identified"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white font-mono">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Email Attachments Links */}
        {data.attachments && data.attachments.length > 0 && (
          <div className="bg-slate-900/20 border border-slate-800/60 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <ImageIcon size={16} className="text-amber-400" /> Email Attachment Files
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.attachments.map((att) => (
                <a 
                  key={att.id} 
                  href={getFileUrl(att.file_path)} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs text-slate-200 hover:text-white font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <FileText size={14} className="text-amber-400" /> {att.filename}
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
