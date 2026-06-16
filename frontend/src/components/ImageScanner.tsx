import React, { useState } from "react";
import { api, Detection } from "../services/api";
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

        {/* Layout */}
        {!annotatedImg ? (
          // File Uploader view
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            {!file ? (
              <label className="w-full max-w-lg border-2 border-dashed border-slate-200 hover:border-sky-500 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-sky-50/10 group">
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
          // Result Output Grid
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Image display */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-center items-center relative min-h-[400px]">
              <img
                src={annotatedImg}
                alt="Processed Scan Output"
                className="w-full h-auto object-contain bg-slate-50"
              />
            </div>

            {/* Results metadata sidebar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[400px]">
              <div className="space-y-4 flex-1">
                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-2 text-sm uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  Detections Complete
                </h3>
                
                <div className="space-y-4 overflow-y-auto max-h-[320px] scroller">
                  {detections.map((plate, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-2 relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-600 text-white shadow-sm">
                          {plate.plate_type.replace(" License Plate", "")}
                        </span>
                        <span className="text-xs text-sky-600 font-bold">
                          {(plate.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Lao Text</p>
                        <p className="font-bold text-lg leading-tight mt-0.5">{plate.ocr_lao}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">English Text</p>
                        <p className="font-medium text-sm mt-0.5">{plate.ocr_en}</p>
                      </div>

                      <div className="flex gap-4 pt-1 text-[11px] text-slate-500 font-medium">
                        <span>BG: <strong className="text-slate-700">{plate.bg_color}</strong></span>
                        <span>Font: <strong className="text-slate-700">{plate.font_color}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset button */}
              <button
                onClick={resetScanner}
                className="w-full mt-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Upload New Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
