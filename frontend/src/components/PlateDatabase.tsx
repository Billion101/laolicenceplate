import React, { useEffect, useState } from "react";
import { api, BACKEND_URL } from "../services/api";
import type { LogRecord } from "../services/api";
import { Database, Search, RefreshCw, AlertCircle, Loader2, Calendar, Trash2 } from "lucide-react";

export const PlateDatabase: React.FC = () => {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getLogs(100); // Fetch top 100 logs
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        setLogs([]);
      }
    } catch (err: any) {
      console.error("Error fetching logs:", err);
      setError("Failed to fetch logs. Make sure the backend is online and MongoDB is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this scan log? This will remove it from the database and delete the image crops on disk.")) {
      return;
    }
    
    try {
      const response = await api.deleteLog(id);
      if (response.success) {
        setLogs((prevLogs) => prevLogs.filter((log) => log._id !== id));
      } else {
        alert(response.error || "Failed to delete log record.");
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs based on search term
  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.ocr_lao.toLowerCase().includes(term) ||
      log.plate_type.toLowerCase().includes(term) ||
      (log._id && log._id.toLowerCase().includes(term))
    );
  });

  // Dynamic Lao plate coloring combinations
  const getPlateBadgeStyle = (plateType: string) => {
    const type = plateType.toLowerCase();
    
    if (type.includes("private")) {
      // Yellow background, black font
      return "bg-[#facc15] text-slate-900 border-[#eab308] border-2 shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
    } else if (type.includes("state")) {
      // Blue background, white font
      return "bg-[#1d4ed8] text-white border-[#1e40af] border-2 shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
    } else if (type.includes("business") && type.includes("1%")) {
      // White background, blue font
      return "bg-white text-[#1d4ed8] border-[#1d4ed8] border-2 shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
    } else if (type.includes("business")) {
      // White background, black font
      return "bg-white text-slate-950 border-slate-300 border-2 shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
    } else if (type.includes("public")) {
      // Red background, white font
      return "bg-[#dc2626] text-white border-[#b91c1c] border-2 shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
    } else if (type.includes("foreign")) {
      // Yellow background, blue font
      return "bg-[#facc15] text-[#1d4ed8] border-[#eab308] border-2 shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
    }
    
    return "bg-slate-100 text-slate-700 border-slate-300 border shadow-sm font-bold uppercase text-[11px] px-2.5 py-1 rounded-md";
  };

  // Helper to extract timestamp from ObjectId (if timestamp isn't explicitly set)
  const formatLogDate = (log: LogRecord) => {
    if (log.timestamp) {
      return new Date(log.timestamp * 1000).toLocaleString();
    }
    // If timestamp is not available, try to parse from the 24-character hex ObjectId
    try {
      if (log._id && log._id.length === 24) {
        const timestamp = parseInt(log._id.substring(0, 8), 16);
        return new Date(timestamp * 1000).toLocaleString();
      }
    } catch (e) {}
    return "Scan Complete";
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-6 h-6 text-sky-600" />
              Plate Database
            </h2>
            <p className="text-sm text-slate-500">
              Browse, search, and verify all license plates scanned by the system.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition bg-white shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Logs
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by OCR text, plate type, or scan ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Error panel */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Logs content */}
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-3" />
            <p className="text-sm font-medium">Loading database logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <Database className="w-16 h-16 text-slate-200 mx-auto stroke-[1.5] mb-3" />
            <h3 className="font-bold text-slate-700">No Records Found</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              {logs.length === 0
                ? "No plates have been scanned yet. Use the Live Camera or Scan Image tabs to capture plates."
                : "No scanned plates match your search criteria. Try a different query."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLogs.map((log) => (
              <div
                key={log._id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col flex-1"
              >
                {/* Crop Image Box */}
                <div className="h-44 bg-slate-100 flex gap-4 items-center justify-center relative overflow-hidden border-b border-slate-100 p-4">
                  {/* Vehicle Crop */}
                  <div className="flex-1 h-full flex flex-col items-center justify-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 shrink-0">Vehicle</span>
                    <div className="flex-1 w-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative">
                      {log.vehicle_image_url ? (
                        <img
                          src={`${BACKEND_URL}${log.vehicle_image_url}`}
                          alt={`Vehicle crop of ${log.ocr_lao}`}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                            (e.target as HTMLImageElement).className = "hidden";
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent && !parent.querySelector(".fallback-text")) {
                              const fallbackSpan = document.createElement("span");
                              fallbackSpan.className = "fallback-text text-[9px] text-slate-400 text-center font-medium px-2";
                              fallbackSpan.innerText = "Unreachable";
                              parent.appendChild(fallbackSpan);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No Image</span>
                      )}
                    </div>
                  </div>

                  {/* Plate Crop */}
                  <div className="flex-1 h-full flex flex-col items-center justify-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase mb-1 shrink-0">Plate</span>
                    <div className="flex-1 w-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative p-1">
                      {log.image_url ? (
                        <img
                          src={`${BACKEND_URL}${log.image_url}`}
                          alt={`Plate crop of ${log.ocr_lao}`}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                            (e.target as HTMLImageElement).className = "hidden";
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent && !parent.querySelector(".fallback-text")) {
                              const fallbackSpan = document.createElement("span");
                              fallbackSpan.className = "fallback-text text-[9px] text-slate-400 text-center font-medium px-2";
                              fallbackSpan.innerText = "Unreachable";
                              parent.appendChild(fallbackSpan);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No Image</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center w-full gap-2">
                      <span className={getPlateBadgeStyle(log.plate_type)}>
                        {log.plate_type.replace(" License Plate", "")}
                      </span>
                      <button
                        onClick={() => handleDelete(log._id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Lao OCR
                      </span>
                      <p className="font-bold text-lg text-slate-800 leading-snug mt-0.5">
                        {log.ocr_lao}
                      </p>
                    </div>
                  </div>

                  {/* Footer Stats */}
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatLogDate(log)}</span>
                    </div>
                    <span className="font-mono text-slate-300">ID: {log._id.substring(18)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
