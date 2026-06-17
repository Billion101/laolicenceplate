import React, { useState } from "react";
import { api } from "../services/api";
import type { Detection } from "../services/api";
import { Upload, Image as ImageIcon, Loader2, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";

export const ImageScanner: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [annotatedImg, setAnnotatedImg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setDetections([]);
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
        setDetections(response.detections);
        setAnnotatedImg(response.annotated_image);
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
    setDetections([]);
    setAnnotatedImg(null);
    setError(null);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-6xl mx-auto space-y-6">
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
          <div className="lg:col-span-7 flex flex-col">
            {!annotatedImg ? (
              // Upload & Preview Phase
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] flex-1">
                {!file ? (
                  <label className="w-full max-w-md border-2 border-dashed border-slate-200 hover:border-sky-500 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-sky-50/10 group">
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 transition">
                      <Upload className="w-7 h-7" />
                    </div>
                    <p className="font-semibold text-slate-700">Click or drag image file here</p>
                    <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, WEBP (Max size 10MB)</p>
                  </label>
                ) : (
                  <div className="w-full max-w-md border border-slate-200 rounded-2xl p-6 text-center space-y-4">
                    <ImageIcon className="w-16 h-16 text-sky-600 mx-auto stroke-[1.5] animate-pulse" />
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
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[400px] flex-1 p-6 space-y-4">
                <div className="flex-1 flex justify-center items-center relative overflow-hidden bg-slate-50 rounded-xl border border-slate-100">
                  <img
                    src={annotatedImg}
                    alt="Processed Scan Output"
                    className="max-h-[380px] w-auto object-contain"
                  />
                </div>

                {/* Reset button under the image box */}
                <button
                  onClick={resetScanner}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  Upload New Image
                </button>
              </div>
            )}
          </div>

          {/* Right panel: Showing the data that had been detected (inline format) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[400px]">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-sm uppercase tracking-wider flex items-center gap-2 shrink-0">
              <CheckCircle className="w-5 h-5 text-sky-600" />
              Detected Plates Data
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 scroller">
              {detections.length > 0 ? (
                detections.map((plate, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/30 flex flex-wrap items-center gap-3 relative overflow-hidden"
                  >
                    {/* Badge Column / Number */}
                    <div className="flex items-center gap-2 w-full">
                      <span className="bg-sky-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">
                        Plate {plate.plate_index}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                        {plate.plate_type.replace(" License Plate", "")}
                      </span>
                      <span className="text-xs text-sky-600 font-bold ml-auto shrink-0">
                        {(plate.confidence * 100).toFixed(0)}% Conf
                      </span>
                    </div>

                    {/* Inline Content Group */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-[120px]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Lao:</span>
                        <span className="font-bold text-slate-800 text-sm">{plate.ocr_lao}</span>
                      </div>

                      <div className="flex items-center gap-1.5 min-w-[100px]">
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
                  <ImageIcon className="w-12 h-12 text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No scans completed yet</p>
                  <p className="text-[11px] max-w-[220px] mt-1">Select an image on the left panel and run the detector.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
