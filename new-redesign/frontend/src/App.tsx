import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  UploadCloud, 
  Image as ImageIcon, 
  Play, 
  Loader2, 
  AlertTriangle, 
  Hash, 
  Tag, 
  Car, 
  Square,
  Camera,
  CameraOff,
  Radio,
  StopCircle,
  RefreshCw,
  Award,
  Sliders
} from 'lucide-react';
import './App.css';

const BACKEND_URL = "http://localhost:8001";

type TabType = 'vehicle_detect' | 'plate_detect' | 'plate_ocr' | 'plate_classify' | 'pipeline_sandbox';

interface Detection {
  box: [number, number, number, number];
  confidence: number;
  class_name?: string;
  char?: string;
}

interface TestResult {
  success: boolean;
  annotated_image?: string;
  detections?: Detection[];
  text_en?: string;
  text_lao?: string;
  predicted_style?: string;
  confidence?: number;
  label?: string;
  bg_color?: string;
  font_color?: string;
  error?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('vehicle_detect');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  
  // Camera & Live Streaming States
  const [useCamera, setUseCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  // Real-time Background filtering (Best candidate selection)
  const [bestResult, setBestResult] = useState<TestResult | null>(null);
  
  // Flexible Pipeline Toggles
  const [runVehicle, setRunVehicle] = useState(true);
  const [runPlate, setRunPlate] = useState(true);
  const [runOcr, setRunOcr] = useState(true);
  const [runClassifier, setRunClassifier] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  // Check backend server connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/`);
        const data = await response.json();
        if (data.status === 'online') {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (err) {
        setBackendStatus('offline');
      }
    };
    checkConnection();
    
    // Enumeration of available media sources on start
    enumerateCameras();
    
    // Cleanup streaming on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // Assign video stream when video element mounts on DOM
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Enumerate cameras
  const enumerateCameras = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.error("Error enumerating cameras: ", e);
    }
  };

  // Web camera activation helper
  const startCamera = async (deviceId?: string) => {
    try {
      setError(null);
      stopCamera(); // Clear any existing stream
      
      const targetDevice = deviceId || selectedDeviceId;
      
      const constraints: MediaStreamConstraints = {
        video: targetDevice 
          ? { deviceId: { exact: targetDevice }, width: 640, height: 480 }
          : { width: 640, height: 480, facingMode: "environment" }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      
      // Update device list again (browsers only expose labels/device names after permission is granted)
      await enumerateCameras();
    } catch (err: any) {
      console.error(err);
      setError("Failed to access camera. Please make sure the correct camera is selected and permissions are granted.");
    }
  };

  const stopCamera = () => {
    stopStreaming();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Evaluation heuristic function to score the quality of frame predictions
  const getResultScore = (res: TestResult, tab: TabType): number => {
    if (!res || !res.success) return 0;
    
    if (tab === 'vehicle_detect' || tab === 'plate_detect') {
      if (!res.detections || res.detections.length === 0) return 0;
      // Score is based on the maximum detection box confidence
      return Math.max(...res.detections.map(d => d.confidence));
    }
    
    if (tab === 'plate_ocr') {
      if (!res.detections || res.detections.length === 0) return 0;
      const count = res.detections.length;
      const avgConf = res.detections.reduce((sum, d) => sum + d.confidence, 0) / count;
      // OCR quality score values structure: prioritize plates with at least 4 characters, scaled by confidence
      return count * 10.0 + avgConf;
    }
    
    if (tab === 'plate_classify') {
      return res.confidence || 0;
    }
    
    return 0;
  };

  const startStreaming = () => {
    if (!cameraActive) return;
    setStreaming(true);
    setResult(null);
    setBestResult(null); // Reset best candidate for the new session
    setError(null);

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");

    // Capture & send canvas frame image
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "live_frame.jpg", { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("file", file);

        let endpoint = "";
        if (activeTab === 'vehicle_detect') endpoint = "/api/v1/test/vehicle-detect";
        else if (activeTab === 'plate_detect') endpoint = "/api/v1/test/plate-detect";
        else if (activeTab === 'plate_ocr') endpoint = "/api/v1/test/plate-ocr";
        else if (activeTab === 'plate_classify') endpoint = "/api/v1/test/plate-classify";

        try {
          const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: "POST",
            body: formData
          });
          const data = await response.json();
          if (data.success) {
            setResult(data);
            
            // Background Filtering Logic: Compare prediction scores
            setBestResult(prevBest => {
              const currentScore = getResultScore(data, activeTab);
              const prevScore = prevBest ? getResultScore(prevBest, activeTab) : 0;
              if (currentScore > prevScore && currentScore > 0.15) { // Filter out random noise boxes
                return data;
              }
              return prevBest;
            });
          }
        } catch (err) {
          console.error("Failed to send frame: ", err);
        }
      }, "image/jpeg", 0.85);
    }, 250); // Frame capture interval 250ms
  };

  const stopStreaming = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStreaming(false);
  };

  // Clear previous outputs when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setBestResult(null);
    setError(null);
    stopCamera();
    if (tab === 'pipeline_sandbox') {
      setUseCamera(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setBestResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setBestResult(null);
      setError(null);
    }
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setBestResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    let endpoint = "";
    if (activeTab === 'vehicle_detect') endpoint = "/api/v1/test/vehicle-detect";
    else if (activeTab === 'plate_detect') endpoint = "/api/v1/test/plate-detect";
    else if (activeTab === 'plate_ocr') endpoint = "/api/v1/test/plate-ocr";
    else if (activeTab === 'plate_classify') endpoint = "/api/v1/test/plate-classify";
    else if (activeTab === 'pipeline_sandbox') {
      endpoint = "/api/v1/test/flexible-pipeline";
      formData.append("run_vehicle", runVehicle.toString());
      formData.append("run_plate", runPlate.toString());
      formData.append("run_ocr", runOcr.toString());
      formData.append("run_classifier", runClassifier.toString());
    }

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Model execution returned an error.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the backend server. Please make sure the backend is running on port 8001.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to resolve styled license plate classes based on background and font color
  const getPlateBadgeClass = (bg?: string, font?: string) => {
    if (!bg || !font) return 'plate-gray';
    const bgLower = bg.toLowerCase();
    const fontLower = font.toLowerCase();

    if (bgLower === 'yellow' && fontLower === 'black') return 'plate-yellow-black';
    if (bgLower === 'yellow' && fontLower === 'blue') return 'plate-yellow-blue';
    if (bgLower === 'blue' && fontLower === 'white') return 'plate-blue-white';
    if (bgLower === 'white' && fontLower === 'black') return 'plate-white-black';
    if (bgLower === 'white' && fontLower === 'blue') return 'plate-white-blue';
    if (bgLower === 'red' && fontLower === 'white') return 'plate-red-white';
    return 'plate-gray';
  };

  // Switch display to best result during webcam session, or fall back to raw result
  const displayResult = useCamera ? (bestResult || result) : result;

  return (
    <div className="redesign-app">
      {/* Top Banner Status Header */}
      <header className="app-header">
        <div className="header-brand">
          <Cpu className="icon-pulse text-sky-400 w-8 h-8" />
          <div>
            <h1>Lao Plate AI System</h1>
            <p>Model Testing Arena & Development Sandbox</p>
          </div>
        </div>

        <div className="header-status">
          <span className={`status-indicator ${backendStatus}`}>
            {backendStatus === 'online' ? 'Backend Live' : backendStatus === 'offline' ? 'Backend Offline' : 'Checking Connection...'}
          </span>
        </div>
      </header>

      {/* Primary Tab Navigation */}
      <nav className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'vehicle_detect' ? 'active' : ''}`}
          onClick={() => handleTabChange('vehicle_detect')}
        >
          <Car className="tab-icon" />
          <span>Vehicle Detector</span>
          <code className="tab-model">vehicle_detect.onnx</code>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'plate_detect' ? 'active' : ''}`}
          onClick={() => handleTabChange('plate_detect')}
        >
          <Square className="tab-icon" />
          <span>Plate Detector</span>
          <code className="tab-model">vehicle_plate.onnx</code>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'plate_ocr' ? 'active' : ''}`}
          onClick={() => handleTabChange('plate_ocr')}
        >
          <Hash className="tab-icon" />
          <span>Plate OCR (Chars)</span>
          <code className="tab-model">plate_text.onnx</code>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'plate_classify' ? 'active' : ''}`}
          onClick={() => handleTabChange('plate_classify')}
        >
          <Tag className="tab-icon" />
          <span>Plate Type Classifier</span>
          <code className="tab-model">plate_classifier.onnx</code>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'pipeline_sandbox' ? 'active' : ''}`}
          onClick={() => handleTabChange('pipeline_sandbox')}
        >
          <Sliders className="tab-icon" />
          <span>Flexible Pipeline</span>
          <code className="tab-model">toggle steps</code>
        </button>
      </nav>

      {/* Main Workspace Layout */}
      <main className="workspace-container">
        
        {/* Left Side: Upload & Input Area */}
        <section className="workspace-panel input-panel">
          <div className="panel-header">
            <h2>Model Input Setup</h2>
            <p>Provide a test target to feed directly into the target model</p>
          </div>

          {/* Toggle File Upload / Live Camera Stream */}
          {activeTab !== 'pipeline_sandbox' && (
            <div className="panel-mode-selector">
              <button 
                className={`mode-btn ${!useCamera ? 'active' : ''}`}
                onClick={() => {
                  stopCamera();
                  setUseCamera(false);
                }}
                disabled={streaming}
              >
                Upload Image File
              </button>
              <button 
                className={`mode-btn ${useCamera ? 'active' : ''}`}
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setResult(null);
                  setBestResult(null);
                  setUseCamera(true);
                  enumerateCameras();
                }}
                disabled={streaming}
              >
                Live Camera Stream
              </button>
            </div>
          )}

          <div className="upload-container">
            {!useCamera ? (
              // Standard Drag & Drop
              !previewUrl ? (
                <label 
                  className="dropzone"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className="hidden-file-input" 
                  />
                  <UploadCloud className="upload-icon" />
                  <span className="upload-title">Drag & drop your test image here</span>
                  <span className="upload-subtitle">or click to browse local files</span>
                  <span className="upload-constraints">Supports JPG, JPEG, PNG</span>
                </label>
              ) : (
                <div className="preview-box">
                  <img src={previewUrl} alt="Upload preview" className="image-preview" />
                  <button 
                    className="btn btn-secondary btn-clear"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setResult(null);
                      setBestResult(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Change Image
                  </button>
                </div>
              )
            ) : (
              // Live camera stream
              <div className="camera-container-box">
                {!cameraActive ? (
                  <div className="camera-prompt-container">
                    {/* Camera Select Dropdown (allows resolving multi-camera indexing bugs) */}
                    {devices.length > 0 && (
                      <div className="camera-select-dropdown">
                        <label htmlFor="cam-select-device">Select Camera Source:</label>
                        <select 
                          id="cam-select-device"
                          value={selectedDeviceId}
                          onChange={(e) => setSelectedDeviceId(e.target.value)}
                        >
                          {devices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera Device (${device.deviceId.substring(0, 6)})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div className="camera-prompt" onClick={() => startCamera()}>
                      <Camera className="camera-prompt-icon" />
                      <span>Turn On Video Camera</span>
                      <small>Connects selected webcam to grab real-time test frames</small>
                    </div>
                  </div>
                ) : (
                  <div className="camera-active-box">
                    <div className="video-stream-frame">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="video-stream-feed"
                      />
                      {streaming && (
                        <div className="live-badge-overlay animate-pulse">
                          <Radio className="w-3 h-3 text-red-500" />
                          LIVE SCANNING
                        </div>
                      )}
                    </div>
                    
                    {/* Camera device switcher (while camera is running) */}
                    {devices.length > 1 && (
                      <div className="camera-live-switcher">
                        <select 
                          value={selectedDeviceId} 
                          onChange={(e) => {
                            const newId = e.target.value;
                            setSelectedDeviceId(newId);
                            startCamera(newId);
                          }}
                          disabled={streaming}
                        >
                          {devices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera (${device.deviceId.substring(0, 5)})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="camera-controls">
                      {!streaming ? (
                        <button className="btn btn-primary btn-cam-action" onClick={startStreaming}>
                          <Play className="mr-2 w-4 h-4" />
                          Start Real-Time Scan
                        </button>
                      ) : (
                        <button className="btn btn-danger btn-cam-action" onClick={stopStreaming}>
                          <StopCircle className="mr-2 w-4 h-4" />
                          Stop Scan
                        </button>
                      )}
                      
                      {bestResult && (
                        <button 
                          className="btn btn-secondary btn-cam-action" 
                          onClick={() => {
                            setBestResult(null);
                            setResult(null);
                          }}
                        >
                          <RefreshCw className="mr-2 w-4 h-4" />
                          Reset Match
                        </button>
                      )}
                      
                      <button className="btn btn-secondary btn-cam-action" onClick={stopCamera} disabled={streaming}>
                        <CameraOff className="mr-2 w-4 h-4" />
                        Turn Off Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!useCamera && (
            <>
              {activeTab === 'pipeline_sandbox' && (
                <div className="pipeline-toggles-container">
                  <h3>Enable/Disable Pipeline Steps</h3>
                  <div className="toggles-grid">
                    <label className="toggle-item">
                      <input 
                        type="checkbox" 
                        checked={runVehicle} 
                        onChange={(e) => setRunVehicle(e.target.checked)} 
                      />
                      <span className="toggle-label">
                        <span className="step-num">Step 1:</span>
                        <span>Vehicle Detector</span>
                      </span>
                    </label>

                    <label className="toggle-item">
                      <input 
                        type="checkbox" 
                        checked={runPlate} 
                        onChange={(e) => setRunPlate(e.target.checked)} 
                      />
                      <span className="toggle-label">
                        <span className="step-num">Step 2:</span>
                        <span>Plate Detector</span>
                      </span>
                    </label>

                    <label className="toggle-item">
                      <input 
                        type="checkbox" 
                        checked={runOcr} 
                        onChange={(e) => setRunOcr(e.target.checked)} 
                      />
                      <span className="toggle-label">
                        <span className="step-num">Step 3:</span>
                        <span>Plate OCR (Chars)</span>
                      </span>
                    </label>

                    <label className="toggle-item">
                      <input 
                        type="checkbox" 
                        checked={runClassifier} 
                        onChange={(e) => setRunClassifier(e.target.checked)} 
                      />
                      <span className="toggle-label">
                        <span className="step-num">Step 4:</span>
                        <span>Plate Style Classifier</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-run"
                disabled={!selectedFile || loading}
                onClick={handleRunInference}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Executing Model...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" />
                    Run ONNX Model
                  </>
                )}
              </button>
            </>
          )}
        </section>

        {/* Right Side: Visual Output Area */}
        <section className="workspace-panel output-panel">
          <div className="panel-header">
            <h2>Model Output Results</h2>
            <p>Visual overlays and model confidence scores retrieved from inference</p>
          </div>

          {error && (
            <div className="panel-alert error">
              <AlertTriangle className="alert-icon" />
              <div>
                <h4>Inference Connection Error</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!error && !loading && !displayResult && (
            <div className="placeholder-output">
              <ImageIcon className="placeholder-icon" />
              <h3>Awaiting Model Run</h3>
              <p>Setup your input image on the left and click "Run ONNX Model" or start your camera stream.</p>
            </div>
          )}

          {loading && (
            <div className="loading-output">
              <Loader2 className="loader-icon animate-spin" />
              <h3>Processing ONNX Inference...</h3>
              <p>Connecting with the backend endpoint to feed image tensor through the neural network.</p>
            </div>
          )}

          {displayResult && (
            <div className="results-wrapper">
              
              {/* Highlight Best Candidate badge when viewing live stream results */}
              {useCamera && bestResult && (
                <div className="best-result-alert">
                  <Award className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h4>Best Candidate Locked In</h4>
                    <p>Displaying the frame that yielded the highest confidence score during this scan session.</p>
                  </div>
                </div>
              )}

              {/* Image Output (For vehicle, plate detect, and OCR) */}
              {displayResult.annotated_image && (
                <div className="annotated-image-box">
                  <h3>Annotated Output</h3>
                  <div className="image-container-frame">
                    <img 
                      src={displayResult.annotated_image} 
                      alt="Annotated Model Output" 
                      className="annotated-image"
                    />
                  </div>
                </div>
              )}

              {/* Specific Metadata Panel based on activeTab */}
              
              {/* Tabs 1 & 2 & Sandbox (if detections present): Detections List */}
              {(activeTab === 'vehicle_detect' || activeTab === 'plate_detect' || (activeTab === 'pipeline_sandbox' && displayResult.detections && displayResult.detections.length > 0)) && displayResult.detections && (
                <div className="output-section">
                  <h3>Bounding Box Detections ({displayResult.detections.length})</h3>
                  {displayResult.detections.length > 0 ? (
                    <div className="detections-grid">
                      {displayResult.detections.map((det, idx) => (
                        <div key={idx} className="detection-card">
                          <div className="det-header">
                            <span className="det-index">Box #{idx + 1}</span>
                            <span className="det-conf">{(det.confidence * 100).toFixed(2)}% Conf</span>
                          </div>
                          {det.class_name && (
                            <div className="det-row">
                              <span className="det-label">Class Name:</span>
                              <strong className="det-value text-sky-400">{det.class_name}</strong>
                            </div>
                          )}
                          <div className="det-row">
                            <span className="det-label">Coordinates:</span>
                            <code className="det-coords">
                              [{det.box.join(', ')}]
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No bounding boxes detected by the model.</p>
                  )}
                </div>
              )}

              {/* Tab 3 & Sandbox (if OCR returned): OCR Characters & Text Sequences */}
              {(activeTab === 'plate_ocr' || (activeTab === 'pipeline_sandbox' && (displayResult.text_en || displayResult.text_lao))) && (
                <div className="output-section">
                  <h3>OCR Text Reconstruction</h3>
                  
                  <div className="ocr-text-showcase">
                    <div className="ocr-text-card">
                      <span className="ocr-card-title">Lao Characters Sequence</span>
                      <p className="ocr-card-value font-lao">{displayResult.text_lao || "No characters reconstructed"}</p>
                    </div>

                    <div className="ocr-text-card">
                      <span className="ocr-card-title">English Text Sequence</span>
                      <p className="ocr-card-value">{displayResult.text_en || "No characters reconstructed"}</p>
                    </div>
                  </div>

                  <h3>Character Detections ({displayResult.detections?.filter(d => d.char).length || 0})</h3>
                  {displayResult.detections && displayResult.detections.filter(d => d.char).length > 0 ? (
                    <div className="char-list">
                      {displayResult.detections.filter(d => d.char).map((det, idx) => (
                        <span key={idx} className="char-badge" title={`Confidence: ${(det.confidence * 100).toFixed(1)}%`}>
                          <strong>{det.char}</strong>
                          <small>{(det.confidence * 100).toFixed(0)}%</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No character bounds detected by the OCR model.</p>
                  )}
                </div>
              )}

              {/* Tab 4 & Sandbox (if classification returned): Classifier Results & Badge */}
              {(activeTab === 'plate_classify' || (activeTab === 'pipeline_sandbox' && displayResult.predicted_style)) && (
                <div className="output-section text-center flex-center">
                  <h3>Style Classification</h3>
                  
                  <div className="badge-preview-container">
                    <div className={getPlateBadgeClass(displayResult.bg_color, displayResult.font_color)}>
                      <span className="badge-title">LAO PEOPLE'S DEMOCRATIC REPUBLIC</span>
                      <div className="badge-main-text">
                        {displayResult.label?.replace(" License Plate (Yellow bg, Black text)", "")
                                     .replace(" License Plate (Blue bg, White text)", "")
                                     .replace(" License Plate 100% (White bg, Black text)", "")
                                     .replace(" License Plate 1% (White bg, Blue text)", "")
                                     .replace(" License Plate (Red bg, White text)", "")
                                     .replace(" License Plate (Yellow bg, Blue text)", "")
                                     .replace(" Plate (White bg, Blue text)", "") || "PLA-TE"}
                      </div>
                      <span className="badge-footer">MODEL TEST DISPLAY ONLY</span>
                    </div>
                  </div>

                  <div className="classify-details">
                    <div className="classify-row">
                      <span>Predicted Style Name:</span>
                      <strong>{displayResult.label}</strong>
                    </div>
                    <div className="classify-row">
                      <span>Class Index ID:</span>
                      <code>{displayResult.predicted_style}</code>
                    </div>
                    <div className="classify-row">
                      <span>Prediction Confidence:</span>
                      <strong className="text-sky-400">{(displayResult.confidence! * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="classify-row">
                      <span>Background Color:</span>
                      <span>{displayResult.bg_color}</span>
                    </div>
                    <div className="classify-row">
                      <span>Font Color:</span>
                      <span>{displayResult.font_color}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </section>

      </main>
    </div>
  );
}

export default App;
