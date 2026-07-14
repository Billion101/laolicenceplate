import React, { useState, useEffect } from "react";
import { api, BACKEND_URL } from "../services/api";
import type { LogRecord } from "../services/api";
import { Upload, Image as ImageIcon, Loader2, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";

export const ImageScanner: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [annotatedImg, setAnnotatedImg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLogsLoading(true);
    try {
      const data = await api.getLogs(20); // Fetch top 20 recent scanned plates
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error("Error fetching logs history:", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setAnnotatedImg(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.scanImage(file);
      if (response.success) {
        setAnnotatedImg(response.annotated_image);
        // Refresh database scan history list
        await fetchHistory();
      } else {
        setError(response.error || "Failed to process image.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An error occurred during image upload. Make sure the backend is online.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetScanner = () => {
    setFile(null);
    setAnnotatedImg(null);
    setError(null);
  };

  const formatTime = (log: LogRecord) => {
    if (log.timestamp) {
      const date = new Date(log.timestamp * (log.timestamp < 1000000000000 ? 1000 : 1));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    try {
      if (log._id && log._id.length === 24) {
        const timestamp = parseInt(log._id.substring(0, 8), 16);
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch (e) {}
    return "Recent";
  };

  const parseLaoOcr = (ocrLao: string) => {
    let province = "";
    let letters = "";
    let numbers = "";

    const parts = ocrLao.split(" | ");
    
    parts.forEach(part => {
      if (part.includes("(") || part.includes("Guessed")) {
        province = part.replace(/\s*\(.*?\)/g, "").trim();
      } else {
        const tokens = part.split(/\s+/).filter(t => t.trim() !== "");
        const lettersList: string[] = [];
        const digitsList: string[] = [];
        
        tokens.forEach(tok => {
          if (/^\d+$/.test(tok) || tok === "?") {
            digitsList.push(tok);
          } else {
            lettersList.push(tok);
          }
        });
        
        letters = lettersList.join("");
        numbers = digitsList.join("");
      }
    });

    if (!province && parts.length > 0) {
      province = parts[0].replace(/\s*\(.*?\)/g, "").trim();
    }
    if (!letters && !numbers && parts.length > 1) {
      const part = parts[1];
      const tokens = part.split(/\s+/);
      letters = tokens.filter(t => !/^\d+$/.test(t) && t !== "?").join("");
      numbers = tokens.filter(t => /^\d+$/.test(t) || t === "?").join("");
    }

    return { province, letters, numbers };
  };

  const translatePlateTypeLao = (plateType: string) => {
    const type = plateType.toLowerCase();
    if (type.includes("private")) return "ສ່ວນຕົວ";
    if (type.includes("government") || type.includes("state")) return "ລັດຖະບານ";
    if (type.includes("business_100") || (type.includes("business") && type.includes("100%"))) return "ວິສາຫະກິດ 100%";
    if (type.includes("business_1") || (type.includes("business") && type.includes("1%"))) return "ວິສາຫະກິດ 1%";
    if (type.includes("public")) return "ສາທາລະນະ";
    if (type.includes("foreign")) return "ຕ່າງປະເທດ";
    if (type.includes("international") || type.includes("organization")) return "ອົງການຈັດຕັ້ງສາກົນ";
    if (type.includes("military") || type.includes("police")) return "ທະຫານ-ຕຳຫຼວດ";
    return "ທົ່ວໄປ";
  };

  const getPlateTypeBadgeStyle = (bg: string, font: string) => {
    const bgLower = bg.toLowerCase();
    const fontLower = font.toLowerCase();
    
    let bgClass = "bg-slate-100 border-slate-300";
    let textClass = "text-slate-800";
    
    if (bgLower === "yellow" && fontLower === "black") {
      bgClass = "bg-[#facc15] border-[#eab308] text-slate-950";
    } else if (bgLower === "yellow" && fontLower === "blue") {
      bgClass = "bg-[#facc15] border-[#eab308] text-[#1d4ed8]";
    } else if (bgLower === "blue" && fontLower === "white") {
      bgClass = "bg-[#1d4ed8] border-[#1e40af] text-white";
    } else if (bgLower === "white" && fontLower === "black") {
      bgClass = "bg-white border-slate-300 text-slate-950";
    } else if (bgLower === "white" && fontLower === "blue") {
      bgClass = "bg-white border-[#1d4ed8] text-[#1d4ed8]";
    } else if (bgLower === "red" && fontLower === "white") {
      bgClass = "bg-[#dc2626] border-[#b91c1c] text-white";
    }
    
    return `${bgClass} border-2 shadow-sm font-bold text-xs px-3 py-1 rounded-lg`;
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-[98%] mx-auto space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Scan Static Image</h2>
          <p className="text-sm text-slate-500">Upload a single photo of a vehicle to extract plate letters, numbers, types, and colors.</p>
        </div>

        {/* Error panel */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Dynamic Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: Box for upload image */}
          <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-0 self-start">
            {!annotatedImg ? (
              // Upload & Preview Phase
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[550px] flex-1">
                {!file ? (
                  <label className="w-full max-w-xl border-2 border-dashed border-slate-200 hover:border-sky-500 rounded-2xl p-20 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-sky-50/10 group">
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-6 text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 transition">
                      <Upload className="w-8 h-8" />
                    </div>
                    <p className="font-semibold text-slate-700 text-lg">Click or drag image file here</p>
                    <p className="text-xs text-slate-400 mt-2">Supports JPG, PNG, WEBP (Max size 10MB)</p>
                  </label>
                ) : (
                  <div className="w-full max-w-xl border border-slate-200 rounded-2xl p-10 text-center space-y-6">
                    <ImageIcon className="w-20 h-20 text-sky-600 mx-auto stroke-[1.5] animate-pulse" />
                    <div>
                      <p className="font-bold text-slate-800 text-lg truncate">{file.name}</p>
                      <p className="text-sm text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    
                    <div className="flex gap-4 pt-2">
                      <button
                        onClick={resetScanner}
                        disabled={isLoading}
                        className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl transition disabled:opacity-50 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={isLoading}
                        className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-sky-100 disabled:opacity-50 text-sm"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          "Scan License Plate"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Results Visual display phase
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[550px] flex-1 p-6 space-y-4">
                <div className="flex-1 flex justify-center items-center relative overflow-hidden bg-slate-50 rounded-xl border border-slate-100">
                  <img
                    src={annotatedImg}
                    alt="Processed Scan Output"
                    className="max-h-[500px] w-auto object-contain"
                  />
                </div>

                {/* Reset button under the image box */}
                <button
                  onClick={resetScanner}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  Upload New Image
                </button>
              </div>
            )}
          </div>

          {/* Right panel: Showing the database scan history (table format) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[550px] overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 shrink-0">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-sky-600" />
                Scanned Plates History
              </h3>
              <button 
                onClick={fetchHistory} 
                disabled={isLogsLoading}
                className="text-slate-400 hover:text-sky-600 transition disabled:opacity-50"
                title="Refresh History"
              >
                <RefreshCw className={`w-4 h-4 ${isLogsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex-1 overflow-auto scroller">
              {isLogsLoading && logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
                  <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-2" />
                  <p className="text-xs font-semibold">Loading scan history...</p>
                </div>
              ) : logs.length > 0 ? (
                <div className="min-w-[650px] inline-block align-middle w-full">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-xs bg-slate-50/70">
                        <th className="py-4 px-4 text-center w-28">ພາຫະນະ</th>
                        <th className="py-4 px-4 text-center w-28">ປ້າຍ</th>
                        <th className="py-4 px-4">ແຂວງ</th>
                        <th className="py-4 px-4">ຕົວອັກສອນ</th>
                        <th className="py-4 px-4">ຕົວເລກ</th>
                        <th className="py-4 px-4">ປະເພດປ້າຍ</th>
                        <th className="py-4 px-4 text-right">ເວລາ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((plate, index) => {
                        const { province, letters, numbers } = parseLaoOcr(plate.ocr_lao);
                        const laoPlateType = translatePlateTypeLao(plate.plate_type);

                        return (
                          <tr key={plate._id || index} className="hover:bg-slate-50/50 transition">
                            {/* 1. Vehicle Thumbnail */}
                            <td className="py-4 px-4">
                              <div className="flex justify-center">
                                {plate.vehicle_image_url ? (
                                  <div className="h-14 w-24 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center relative group shadow-sm transition hover:scale-105" title="Vehicle Crop">
                                    <img
                                      src={`${BACKEND_URL}${plate.vehicle_image_url}`}
                                      alt="Vehicle"
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300">N/A</span>
                                )}
                              </div>
                            </td>
                            {/* 2. Plate Thumbnail */}
                            <td className="py-4 px-4">
                              <div className="flex justify-center">
                                {plate.image_url ? (
                                  <div className="h-14 w-24 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center relative group shadow-sm p-0.5 transition hover:scale-105" title="Plate Crop">
                                    <img
                                      src={`${BACKEND_URL}${plate.image_url}`}
                                      alt="Plate"
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300">N/A</span>
                                )}
                              </div>
                            </td>
                            {/* 3. Province (Lao) */}
                            <td className="py-4 px-4 font-semibold text-slate-800 text-sm whitespace-nowrap">
                              {province || "-"}
                            </td>
                            {/* 4. Letter (Lao) */}
                            <td className="py-4 px-4 font-bold text-slate-800 text-base whitespace-nowrap">
                              {letters || "-"}
                            </td>
                            {/* 5. Number */}
                            <td className="py-4 px-4 font-bold text-slate-800 text-base whitespace-nowrap">
                              {numbers || "-"}
                            </td>
                            {/* 6. Plate Type (Lao) */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className={getPlateTypeBadgeStyle(plate.bg_color, plate.font_color)}>
                                {laoPlateType}
                              </span>
                            </td>
                            {/* 7. Time */}
                            <td className="py-4 px-4 text-right font-medium text-slate-500 text-xs whitespace-nowrap">
                              {formatTime(plate)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-16">
                  <ImageIcon className="w-12 h-12 text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No scans completed yet</p>
                  <p className="text-[11px] max-w-[220px] mt-1 text-slate-400">Select an image on the left panel and run the detector.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
