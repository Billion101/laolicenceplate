import React, { useState, useEffect, useRef } from "react";
import { api, BACKEND_URL } from "../services/api";
import type { LogRecord } from "../services/api";
import { Upload, Film, Loader2, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";

export const VideoScanner: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<LogRecord[]>([]);

  const pollingIntervalRef = useRef<number | null>(null);
  const scanStartTimeRef = useRef<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStreamUrl(null);
      setDetections([]);
      setError(null);
    }
  };

  const startPolling = () => {
    // Capture the time we started scanning in seconds
    scanStartTimeRef.current = Date.now() / 1000;
    setDetections([]);

    // Clear any existing poll
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Set polling interval to fetch latest database entries matching this video session
    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const logs = await api.getLogs(30);
        if (Array.isArray(logs)) {
          // Filter logs that were scanned after our start time
          const freshDetections = logs.filter(
            (log) => log.timestamp && log.timestamp >= scanStartTimeRef.current - 2.0 // buffer slightly
          );
          
          setDetections(freshDetections);
        }
      } catch (err) {
        console.error("Error polling logs:", err);
      }
    }, 1500);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setStreamUrl(null);
    setDetections([]);

    try {
      const result = await api.uploadVideo(file);
      if (result.success && result.filename) {
        // Set stream URL to feed the <img> tag
        setStreamUrl(api.getVideoStreamUrl(result.filename));
        // Start polling logs
        startPolling();
      } else {
        setError(result.error || "Failed to process video.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An error occurred during video upload. Make sure the backend is online.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetScanner = () => {
    stopPolling();
    setFile(null);
    setStreamUrl(null);
    setDetections([]);
    setError(null);
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Process Video File</h2>
          <p className="text-sm text-slate-500">Upload pre-recorded videos to run the YOLO license plate detector frame-by-frame.</p>
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
          {/* Left Panel: Box for upload video / video display */}
          <div className="lg:col-span-7 flex flex-col">
            {!file && !streamUrl && (
              // Dropzone view
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] flex-1">
                <label className="w-full max-w-md border-2 border-dashed border-slate-200 hover:border-sky-500 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-sky-50/10 group">
                  <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 transition">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="font-semibold text-slate-700">Click or drag video file here</p>
                  <p className="text-xs text-slate-400 mt-1">Supports MP4, AVI, MOV (Max size 50MB)</p>
                </label>
              </div>
            )}

            {file && !streamUrl && (
              // Upload preview view
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] flex-1">
                <div className="w-full max-w-md border border-slate-200 rounded-2xl p-6 text-center space-y-4">
                  <Film className="w-16 h-16 text-sky-600 mx-auto stroke-[1.5] animate-pulse" />
                  <div>
                    <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={resetScanner}
                      disabled={isLoading}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl transition disabled:opacity-50 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={isLoading}
                      className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-sky-100 disabled:opacity-50 text-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Upload and Scan"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {streamUrl && (
              // Streaming MJPEG video overlay output
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[400px] flex-1 space-y-4">
                <div className="flex-1 relative border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-black flex items-center justify-center">
                  <img
                    src={streamUrl}
                    alt="YOLO Video Bounding Box Output"
                    className="max-h-[380px] w-auto object-contain"
                    onError={() => {
                      stopPolling();
                    }}
                  />
                </div>

                <div className="flex justify-between items-center w-full border border-sky-100 bg-sky-50/20 px-6 py-3 rounded-xl shrink-0">
                  <div className="flex items-center gap-2.5 text-slate-600 text-xs font-semibold">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span>Streaming processed frames...</span>
                  </div>
                  <button
                    onClick={resetScanner}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset Video
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Real-Time Inline Detections */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[400px]">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-sm uppercase tracking-wider flex items-center gap-2 shrink-0">
              <CheckCircle className="w-5 h-5 text-sky-600" />
              Real-Time Scan Logs
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 scroller">
              {detections.length > 0 ? (
                detections.map((plate, index) => (
                  <div
                    key={plate._id || index}
                    className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/30 flex flex-wrap items-center gap-3 relative overflow-hidden"
                  >
                    {/* Badge Row */}
                    <div className="flex items-center gap-2 w-full">
                      <span className="bg-sky-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">
                        Log {detections.length - index}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                        {plate.plate_type.replace(" License Plate", "").split(" (")[0]}
                      </span>
                      <span className="text-xs text-sky-600 font-bold ml-auto shrink-0">
                        {(plate.confidence * 100).toFixed(0)}% Conf
                      </span>
                    </div>

                    {/* Inline Content Group */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full pt-1.5 border-t border-slate-100">
                      {/* Plate Crop image thumbnail if available */}
                      {plate.image_url && (
                        <div className="w-12 h-6 bg-slate-50 border border-slate-200 rounded overflow-hidden flex items-center justify-center shrink-0">
                          <img
                            src={`${BACKEND_URL}${plate.image_url}`}
                            alt="Crop Thumbnail"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 min-w-[100px]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Lao:</span>
                        <span className="font-bold text-slate-800 text-sm">{plate.ocr_lao}</span>
                      </div>

                      <div className="flex items-center gap-1.5 min-w-[90px]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">EN:</span>
                        <span className="font-medium text-slate-700 text-xs">{plate.ocr_en}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 ml-auto">
                        <span>BG: <strong className="text-slate-600 font-semibold">{plate.bg_color}</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>Font: <strong className="text-slate-600 font-semibold">{plate.font_color}</strong></span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
                  <Film className="w-12 h-12 text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No active scan logs</p>
                  <p className="text-[11px] max-w-[220px] mt-1">Upload and scan a video on the left. Detected crops will stream here live.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
