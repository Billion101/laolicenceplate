import React, { useState, useEffect, useRef } from "react";
import { BACKEND_URL } from "../services/api";
import { Camera, CameraOff, Loader2, AlertCircle, RefreshCw, CheckCircle, Database } from "lucide-react";

interface WebcamDetection {
  ocr_en: string;
  ocr_lao: string;
  bg_color: string;
  font_color: string;
  plate_type: string;
  confidence: number;
  is_duplicate: boolean;
  logged: boolean;
  image_url?: string;
  vehicle_image_url?: string;
}

export const WebcamScanner: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamImgUrl, setStreamImgUrl] = useState<string | null>(null);
  
  // Detections on the current frame
  const [activeDetections, setActiveDetections] = useState<WebcamDetection[]>([]);
  
  // Unique detections logged to DB in this session
  const [sessionLogs, setSessionLogs] = useState<WebcamDetection[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStreamingRef = useRef<boolean>(false);

  // Initialize canvas for capturing frames
  const captureFrameAndSend = () => {
    if (!isStreamingRef.current || !videoRef.current || !canvasRef.current || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions to match video aspect ratio (downscale slightly for speed if desired, e.g. 640x360)
    canvas.width = 640;
    canvas.height = 360;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Frame = canvas.toDataURL("image/jpeg", 0.7); // 70% quality compression
      
      wsRef.current.send(JSON.stringify({ frame: base64Frame }));
    } catch (err) {
      console.error("Failed to capture frame:", err);
    }
  };

  const startCamera = async () => {
    setIsStarting(true);
    setError(null);
    setActiveDetections([]);
    setStreamImgUrl(null);

    try {
      // 1. Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment" // use rear camera on mobile if available
        }
      });
      
      streamRef.current = stream;
      
      // Create off-screen video element to feed the stream
      const video = document.createElement("video");
      video.setAttribute("playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.muted = true;
      video.srcObject = stream;
      
      video.onloadedmetadata = () => {
        video.play().then(() => {
          videoRef.current = video;
          
          // 2. Establish WebSocket connection
          const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const wsHost = BACKEND_URL.replace(/^https?:\/\//, "");
          const wsUrl = `${wsProtocol}//${wsHost}/api/v1/scan/ws`;
          
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            console.log("WebSocket connected. Starting stream...");
            setIsActive(true);
            setIsStarting(false);
            isStreamingRef.current = true;
            captureFrameAndSend(); // trigger the first frame send
          };

          ws.onmessage = (event) => {
            try {
              const response = JSON.parse(event.data);
              if (response.error) {
                console.error("Server WebSocket error:", response.error);
              } else {
                // Update processed frame image source
                setStreamImgUrl(response.annotated_image);
                
                // Update active/current detections
                const frameDets: WebcamDetection[] = response.detections || [];
                setActiveDetections(frameDets);

                // Add newly logged detections to session list
                frameDets.forEach((det) => {
                  if (det.logged) {
                    setSessionLogs((prev) => {
                      // Check for duplicate in session list
                      const alreadyExists = prev.some(
                        (item) => item.ocr_en.replace(/\s+/g, "") === det.ocr_en.replace(/\s+/g, "")
                      );
                      if (!alreadyExists) {
                        return [det, ...prev];
                      }
                      return prev;
                    });
                  }
                });
              }
            } catch (err) {
              console.error("Error parsing websocket message:", err);
            }

            // Ack-based streaming: Send the next frame only after the backend responds to the previous one
            // We introduce a small delay (50ms) to prevent overloading the network interface
            if (isStreamingRef.current) {
              setTimeout(() => {
                captureFrameAndSend();
              }, 50);
            }
          };

          ws.onerror = (err) => {
            console.error("WebSocket connection error:", err);
            setError("WebSocket connection failed. Verify the backend is online.");
            stopCamera();
          };

          ws.onclose = () => {
            console.log("WebSocket connection closed.");
            setIsActive(false);
            setIsStarting(false);
          };
        });
      };
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please grant permission in your browser settings."
          : "Unable to access camera. Make sure no other application is using it."
      );
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    isStreamingRef.current = false;
    
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Reset video refs
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setIsActive(false);
    setIsStarting(false);
    setStreamImgUrl(null);
    setActiveDetections([]);
  };

  const clearSessionLogs = () => {
    setSessionLogs([]);
  };

  useEffect(() => {
    // Clean up when leaving screen
    return () => {
      isStreamingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto scroller">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Live Camera Scan</h2>
            <p className="text-sm text-slate-500">Run real-time vehicle classification, plate detection, and OCR using your webcam.</p>
          </div>
          {isActive && (
            <div className="flex items-center gap-2.5 self-start sm:self-auto px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Camera Stream Live</span>
            </div>
          )}
        </div>

        {/* Error panel */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Hidden Canvas for extracting frame blobs */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Main Interface Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live camera feed */}
          <div className="lg:col-span-7 flex flex-col">
            {!isActive && !isStarting && (
              // Start stream dashboard card
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[420px] flex-1 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                  <Camera className="w-10 h-10 stroke-[1.2]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-700">Camera offline</h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">Press the button below to request camera permissions and start streaming.</p>
                </div>
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition shadow-md shadow-sky-100 flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Enable & Start Webcam
                </button>
              </div>
            )}

            {isStarting && (
              // Starting up loader
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[420px] flex-1 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-sky-600 animate-spin stroke-[1.5]" />
                <div>
                  <p className="font-semibold text-slate-700">Accessing media devices...</p>
                  <p className="text-xs text-slate-400 mt-1">Please accept camera permissions in your browser prompt.</p>
                </div>
              </div>
            )}

            {isActive && (
              // Live active processed frame output
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[420px] flex-1 space-y-4">
                <div className="flex-1 relative border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-black flex items-center justify-center">
                  {streamImgUrl ? (
                    <img
                      src={streamImgUrl}
                      alt="AI Detection Overlay"
                      className="max-h-[380px] w-auto object-contain"
                    />
                  ) : (
                    <div className="flex items-center gap-2.5 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Warming up pipeline...</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center w-full bg-slate-50 px-5 py-3 rounded-xl border border-slate-100 shrink-0">
                  <div className="text-xs text-slate-500 font-medium">
                    Ack-buffered websocket stream
                  </div>
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition border border-rose-100"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    Stop Stream
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Data Feed and Session Log History */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Box 1: Currently Active Plate (Current Frame) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col shrink-0">
              <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
                Currently In View
              </h3>

              {activeDetections.length > 0 ? (
                <div className="space-y-4">
                  {activeDetections.map((det, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-sky-100 bg-sky-50/20 relative overflow-hidden flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-sky-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          Active Target
                        </span>
                        <span className="text-xs text-sky-600 font-extrabold">
                          {(det.confidence * 100).toFixed(0)}% Match
                        </span>
                      </div>
                      
                      {/* Big Plate display */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100/50">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lao Script</p>
                          <p className="text-xl font-black text-slate-800">{det.ocr_lao}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">English Characters</p>
                          <p className="text-lg font-bold text-slate-700">{det.ocr_en}</p>
                        </div>
                      </div>

                      {/* Plate Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100/50 pt-2.5 mt-1 bg-slate-50/50 p-2.5 rounded-xl">
                        <div>
                          <span className="text-slate-400 font-medium">BG: </span>
                          <strong className="text-slate-700">{det.bg_color}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Font: </span>
                          <strong className="text-slate-700">{det.font_color}</strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 font-medium">Type: </span>
                          <strong className="text-slate-700">{det.plate_type.replace(" License Plate", "")}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
                  <Camera className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs font-semibold text-slate-500">Awaiting detection</p>
                  <p className="text-[10px] max-w-[200px] mt-0.5">Present a license plate in front of the active camera stream.</p>
                </div>
              )}
            </div>

            {/* Box 2: Session unique logs (De-duplicated) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col flex-1 min-h-[250px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  Session Capture History ({sessionLogs.length})
                </h3>
                {sessionLogs.length > 0 && (
                  <button
                    onClick={clearSessionLogs}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline transition"
                  >
                    Clear History
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 scroller max-h-[250px]">
                {sessionLogs.length > 0 ? (
                  sessionLogs.map((log, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl border border-slate-150 bg-slate-50/50 flex flex-wrap items-center gap-2 relative overflow-hidden"
                    >
                      {/* Badge row */}
                      <div className="flex items-center gap-2 w-full">
                        <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Logged
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-white text-slate-700 border border-slate-200 shrink-0">
                          {log.plate_type.replace(" License Plate", "")}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-auto font-medium">
                          {(log.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </div>

                      {/* Content row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full pt-1.5 border-t border-slate-100">
                        {/* Dynamic DB image rendering if logged */}
                        {log.image_url && (
                          <div className="w-12 h-6 bg-slate-50 border border-slate-200 rounded overflow-hidden flex items-center justify-center shrink-0">
                            <img
                              src={`${BACKEND_URL}${log.image_url}`}
                              alt="Crop Thumbnail"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-1 min-w-[80px]">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Lao:</span>
                          <span className="font-bold text-slate-800 text-xs">{log.ocr_lao}</span>
                        </div>

                        <div className="flex items-center gap-1 min-w-[70px]">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">EN:</span>
                          <span className="font-medium text-slate-700 text-xs">{log.ocr_en}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-10">
                    <Database className="w-10 h-10 text-slate-200 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">No plates captured yet</p>
                    <p className="text-[10px] max-w-[200px] mt-0.5">Unique plates captured during this session will register here.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
