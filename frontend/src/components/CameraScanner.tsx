import React, { useEffect, useRef, useState } from "react";
import { api, Detection } from "../services/api";
import { Play, Square, Loader2, AlertCircle } from "lucide-react";

export const CameraScanner: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [streamFrame, setStreamFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  // Stop camera and WebSocket
  const stopScanner = () => {
    setIsPlaying(false);
    setStreamFrame(null);
    setDetections([]);

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  // Start camera and WebSocket
  const startScanner = async () => {
    setError(null);
    setIsLoading(true);
    setDetections([]);

    try {
      // 1. Initialize Webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "environment" },
        audio: false,
      });

      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 2. Initialize WebSocket
      const wsUrl = api.getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsLoading(false);
        setIsPlaying(true);

        // Start sending frames every 150ms (~6-7 frames per second to balance CPU/accuracy)
        intervalIdRef.current = window.setInterval(() => {
          sendFrame();
        }, 150);
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.success) {
            if (response.detections && response.detections.length > 0) {
              setDetections(response.detections);
            }
            if (response.annotated_frame) {
              setStreamFrame(response.annotated_frame);
            }
          }
        } catch (err) {
          console.error("Error reading WebSocket payload:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
        setError("WebSocket server connection failed. Make sure the backend is online.");
        stopScanner();
      };

      ws.onclose = () => {
        setIsPlaying(false);
      };

    } catch (err: any) {
      console.error("Webcam permissions error:", err);
      setError(err.name === "NotAllowedError" 
        ? "Permission denied. Please grant webcam access in your browser settings." 
        : "Failed to open camera: " + err.message
      );
      setIsLoading(false);
      stopScanner();
    }
  };

  const sendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (ctx && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Convert to blob and send
      canvas.toBlob((blob) => {
        if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          blob.arrayBuffer().then((buffer) => {
            wsRef.current?.send(buffer);
          });
        }
      }, "image/jpeg", 0.7); // compress slightly to reduce socket payload size
    }
  };

  useEffect(() => {
    // Stop camera on unmount
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title / Description */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Live Camera Stream</h2>
            <p className="text-sm text-slate-500">Scan license plates in real-time over WebSockets using your camera.</p>
          </div>
          <div className="flex gap-3">
            {!isPlaying ? (
              <button
                onClick={startScanner}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold transition shadow-md shadow-sky-100 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Warming YOLO...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white" />
                    Start Camera
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold transition shadow-md shadow-rose-100"
              >
                <Square className="w-5 h-5 fill-white" />
                Stop Scanner
              </button>
            )}
          </div>
        </div>

        {/* Errors */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Video feed + Detections sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stream Display */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-center items-center min-h-[400px] relative">
            {/* Hidden Video element for frame capture */}
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="hidden" />

            {isPlaying && streamFrame ? (
              <img
                src={streamFrame}
                alt="Processed Live Feed"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-center p-8 text-slate-400">
                <Camera className="w-16 h-16 text-slate-300 stroke-[1.5] mb-3" />
                <p className="font-semibold text-slate-600">Camera is Offline</p>
                <p className="text-xs max-w-sm mt-1">Click the Start Camera button to capture live camera feed and run YOLO text detection.</p>
              </div>
            )}
          </div>

          {/* Detections sidebar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-[400px] lg:h-auto">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-sm uppercase tracking-wider">
              Real-Time Bounding Box OCR
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 scroller">
              {detections.length > 0 ? (
                detections.map((plate, index) => (
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

                    <div className="text-slate-800">
                      <p className="text-xs font-semibold text-slate-400 uppercase">Lao Text</p>
                      <p className="font-bold text-lg leading-tight mt-0.5">{plate.ocr_lao}</p>
                    </div>

                    <div className="text-slate-800">
                      <p className="text-xs font-semibold text-slate-400 uppercase">English Text</p>
                      <p className="font-medium text-sm mt-0.5">{plate.ocr_en}</p>
                    </div>

                    <div className="flex gap-4 pt-1 text-[11px] text-slate-500 font-medium">
                      <span>BG: <strong className="text-slate-700">{plate.bg_color}</strong></span>
                      <span>Font: <strong className="text-slate-700">{plate.font_color}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                  <Play className="w-8 h-8 stroke-[1.5] text-slate-300 mb-2 animate-bounce" />
                  <p className="text-xs">Waiting for active plate recognition...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
