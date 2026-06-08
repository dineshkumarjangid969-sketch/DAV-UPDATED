import React, { useState } from 'react';
import { Upload, Map as MapIcon, RefreshCw, GripVertical, Truck, Users, Plus, Settings2, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const TRUCK_COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#ec4899"];

const RosterPlanner = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  
  // CVRP State
  const [rawOrders, setRawOrders] = useState([]);
  const [routeData, setRouteData] = useState({ trucks: [], unassignedOrders: [] });
  const [activeTruckTab, setActiveTruckTab] = useState(1);
  const [error, setError] = useState('');

  const [fleetConfig, setFleetConfig] = useState([
    { id: 1, driver: "Driver 1", capacity: 20, hasOffsider: true },
    { id: 2, driver: "Driver 2", capacity: 15, hasOffsider: false }
  ]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:5000/api/routes/upload-manifest', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setRawOrders(data.orders);
        setRouteData({ trucks: [], unassignedOrders: data.orders });
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOptimize = async () => {
    if (rawOrders.length === 0) return;
    setOptimizing(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: rawOrders, start_store: 'Wiri DC', fleetConfig })
      });
      const data = await res.json();
      if (res.ok) {
        setRouteData(data);
        if (data.trucks && data.trucks.length > 0) {
          setActiveTruckTab(data.trucks[0].truckId);
        }
      } else {
        setError(data.error || 'Optimization failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const addTruck = () => {
    const newId = fleetConfig.length > 0 ? Math.max(...fleetConfig.map(t => t.id)) + 1 : 1;
    setFleetConfig([...fleetConfig, { id: newId, driver: `Driver ${newId}`, capacity: 15, hasOffsider: false }]);
  };

  const updateTruck = (id, field, value) => {
    setFleetConfig(fleetConfig.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTruck = (id) => {
    setFleetConfig(fleetConfig.filter(t => t.id !== id));
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    // For now, only supporting reordering within the same truck
    if (result.source.droppableId === result.destination.droppableId) {
      const truckIdStr = result.source.droppableId.split('-')[1];
      if (!truckIdStr) return;
      const truckId = parseInt(truckIdStr, 10);
      
      const truckIndex = routeData.trucks.findIndex(t => t.truckId === truckId);
      if (truckIndex === -1) return;

      const newTrucks = [...routeData.trucks];
      const items = Array.from(newTrucks[truckIndex].waypoints);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      
      newTrucks[truckIndex].waypoints = items;
      setRouteData({ ...routeData, trucks: newTrucks });
    }
  };

  const allWaypoints = routeData.trucks.flatMap(t => t.waypoints.filter(w => w.lat && w.lon)) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 overflow-y-auto pb-8 hide-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-4 rounded-xl border border-slate-700 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings2 className="text-blue-400" /> Fleet Dispatch & CVRP Planner
          </h2>
          <p className="text-sm text-slate-400">Manage load capacities, personnel, and multi-vehicle routing.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" id="manifest-upload" className="hidden" accept=".csv, .xlsx" onChange={handleFileChange} />
          <label htmlFor="manifest-upload" className="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors text-white">
            {file ? file.name : "1. Select Manifest"}
          </label>
          <button 
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
          >
            {uploading ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
            2. Upload
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl flex-shrink-0">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fleet Configuration Panel */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Truck size={18} className="text-blue-400" /> Fleet Configuration
            </h3>
            <button onClick={addTruck} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors">
              <Plus size={14} /> Add Truck
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-500 border-b border-slate-700">
                <tr>
                  <th className="pb-3 font-medium">Truck ID</th>
                  <th className="pb-3 font-medium">Capacity (m³)</th>
                  <th className="pb-3 font-medium text-center">Offsider Req.</th>
                  <th className="pb-3 font-medium text-right">Current Load</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {fleetConfig.map(t => {
                  const assignedData = routeData.trucks.find(rt => rt.truckId === t.id);
                  const load = assignedData ? assignedData.currentLoad : 0;
                  const util = assignedData ? assignedData.utilization : 0;
                  
                  return (
                    <tr key={t.id} className="group">
                      <td className="py-3 font-medium text-white flex items-center gap-2">
                        <Truck size={14} className="text-slate-500" />
                        <input 
                          type="text" 
                          value={t.driver} 
                          onChange={(e) => updateTruck(t.id, 'driver', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none w-24"
                        />
                      </td>
                      <td className="py-3">
                        <input 
                          type="number" 
                          value={t.capacity} 
                          onChange={(e) => updateTruck(t.id, 'capacity', parseInt(e.target.value) || 0)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-3 text-center">
                        <button 
                          onClick={() => updateTruck(t.id, 'hasOffsider', !t.hasOffsider)}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${t.hasOffsider ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}
                        >
                          {t.hasOffsider ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`${util > 90 ? 'text-amber-400' : 'text-slate-300'}`}>{load.toFixed(1)} m³</span>
                          <div className="w-24 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full ${util > 90 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(util, 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => removeTruck(t.id)} className="text-red-400 hover:text-red-300 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
             <button 
                onClick={handleOptimize}
                disabled={optimizing || rawOrders.length === 0}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {optimizing ? <RefreshCw className="animate-spin" size={16} /> : <Settings2 size={16} />}
                3. Optimize Fleet
              </button>
          </div>
        </div>

        {/* Unassigned Pool */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <AlertTriangle size={18} className={routeData.unassignedOrders.length > 0 ? "text-amber-400" : "text-slate-500"} /> 
              Unassigned Orders
            </h3>
            <span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-white font-bold">{routeData.unassignedOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 max-h-[300px]">
            {routeData.unassignedOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">All orders assigned!</div>
            ) : (
              <div className="space-y-2">
                {routeData.unassignedOrders.map((o, i) => {
                  const size = o.parsedSize || parseFloat(o.size || o.Size || o['Size (m³)'] || o.CBM || o.Volume) || 0.1;
                  return (
                    <div key={i} className="bg-slate-900/50 border border-slate-700 p-2 rounded flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-slate-200">{o.order_number || o.invoice_number || `Order ${i}`}</div>
                        <div className="text-xs text-slate-500">{o.pickup_store || 'Unknown'} -> {o.destination_address || o.destination_store}</div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${size > 1.0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                          {size.toFixed(1)} m³
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map & Itinerary View */}
      {routeData.trucks.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[500px]">
          {/* Map View */}
          <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative">
            <MapContainer 
              center={[-36.8485, 174.7633]} 
              zoom={10} 
              style={{ height: '100%', width: '100%' }}
              bounds={allWaypoints.length > 0 ? allWaypoints.map(w => [w.lat, w.lon]) : undefined}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              />
              {routeData.trucks.map((truck, tIdx) => {
                const color = TRUCK_COLORS[tIdx % TRUCK_COLORS.length];
                const validWps = truck.waypoints.filter(w => w.lat && w.lon);
                return (
                  <React.Fragment key={truck.truckId}>
                    {validWps.map((wp, i) => (
                      <Marker key={`${truck.truckId}-${i}`} position={[wp.lat, wp.lon]}>
                        <Popup>
                          <strong className="text-slate-900">{truck.driver} - Stop {i + 1}</strong><br/>
                          <span className="text-slate-700 font-medium">{wp.name}</span><br/>
                          <span className="text-slate-500 text-xs">{wp.type}</span>
                        </Popup>
                      </Marker>
                    ))}
                    <Polyline 
                      positions={validWps.map(w => [w.lat, w.lon])}
                      color={color} 
                      weight={activeTruckTab === truck.truckId ? 5 : 3} 
                      opacity={activeTruckTab === truck.truckId ? 1 : 0.4}
                    />
                  </React.Fragment>
                );
              })}
            </MapContainer>
            <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 p-3 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
              <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Fleet Totals</div>
              <div className="text-2xl font-bold text-white">{routeData.total_distance_km} <span className="text-sm text-slate-400 font-normal">km</span></div>
              <div className="text-sm font-medium text-emerald-400 mt-1">{(routeData.trucks.reduce((sum, t) => sum + (t.currentLoad||0), 0)).toFixed(1)} m³ Assigned</div>
            </div>
          </div>

          {/* Sequence List */}
          <div className="w-full lg:w-96 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-700 bg-slate-900/50 p-2 gap-2 hide-scrollbar">
              {routeData.trucks.map((truck, tIdx) => {
                const color = TRUCK_COLORS[tIdx % TRUCK_COLORS.length];
                const isActive = activeTruckTab === truck.truckId;
                return (
                  <button
                    key={truck.truckId}
                    onClick={() => setActiveTruckTab(truck.truckId)}
                    className={`flex-shrink-0 flex flex-col items-start px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                      isActive ? 'bg-slate-800 text-white shadow-lg border border-slate-600' : 'text-slate-400 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Truck size={14} color={color} />
                      {truck.driver}
                    </div>
                    <span className="text-[10px] font-normal text-slate-500">{truck.utilization}% Load</span>
                  </button>
                );
              })}
            </div>

            {routeData.trucks.filter(t => t.truckId === activeTruckTab).map((truck) => (
              <div key={truck.truckId} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId={`truck-${truck.truckId}`}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {truck.waypoints.map((wp, index) => (
                          <Draggable key={`${wp.name}-${index}`} draggableId={`${wp.name}-${index}`} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`p-3 rounded-lg border flex gap-3 ${
                                  wp.type === 'START' || wp.type === 'END' ? 'bg-slate-900 border-slate-700 opacity-80' :
                                  wp.type === 'PICKUP' ? 'bg-blue-500/10 border-blue-500/30' : 
                                  'bg-slate-700/50 border-slate-600'
                                }`}
                              >
                                {wp.type !== 'START' && wp.type !== 'END' && (
                                  <div {...provided.dragHandleProps} className="text-slate-500 mt-1 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={16} />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                        wp.type === 'PICKUP' ? 'bg-blue-500 text-white' : 
                                        wp.type === 'START' || wp.type === 'END' ? 'bg-slate-600 text-white' :
                                        'bg-slate-600 text-slate-200'
                                      }`}>
                                        {wp.type}
                                      </span>
                                      <span className="text-xs text-slate-400">{wp.distanceFromPrev ? `${wp.distanceFromPrev.toFixed(1)} km` : ''}</span>
                                    </div>
                                    {wp.size > 0 && (
                                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                        {wp.size.toFixed(1)} m³
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-medium text-sm text-slate-200 mt-1 truncate">{wp.name}</div>
                                  {wp.orderNumber && <div className="text-xs text-slate-400 mt-0.5">Order: {wp.orderNumber}</div>}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterPlanner;
