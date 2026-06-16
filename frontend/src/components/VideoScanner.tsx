import React, { useState } from "react";
import { api } from "../services/api";
import { Upload, Film, Loader2, AlertCircle, RefreshCw } from "lucide-react";

export const VideoScanner: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStreamUrl(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setStreamUrl(null);

    try {
      const result = await api.uploadVideo(file);
      if (result.success && result.filename) {
        // Set stream URL to feed the <img> tag
        setStreamUrl(api.getVideoStreamUrl(result.filename));
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
    setFile(null);
    setStreamUrl(null);
    setError(null);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-4xl mx-auto space-y-6">
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

        {/* Main Work Area */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
          {!file && !streamUrl && (
            // Dropzone view
            <label className="w-full max-w-lg border-2 border-dashed border-slate-200 hover:border-sky-500 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-sky-50/10 group">
              <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 transition">
                <Upload className="w-7 h-7" />
              </div>
              <p className="font-semibold text-slate-700">Click or drag video file here</p>
              <p className="text-xs text-slate-400 mt-1">Supports MP4, AVI, MOV (Max size 50MB)</p>
            </label>
          )}

          {file && !streamUrl && (
            // Upload preview view
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
          )}

          {streamUrl && (
            // Streaming MJPEG video overlay output
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="w-full relative border border-slate-200 rounded-2xl overflow-hidden shadow-md">
                <img
                  src={streamUrl}
                  alt="YOLO Video Recognition Overlay"
                  className="w-full h-auto object-contain max-h-[500px] bg-black"
                />
              </div>

              <div className="flex justify-between items-center w-full max-w-lg border border-sky-100 bg-sky-50/20 px-6 py-3 rounded-xl">
                <div className="flex items-center gap-2.5 text-slate-600 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span>Streaming processed frame feed...</span>
                </div>
                <button
                  onClick={resetScanner}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
