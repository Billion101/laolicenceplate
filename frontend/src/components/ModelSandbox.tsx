import React, { useState } from "react";
import { api, BACKEND_URL } from "../services/api";
import { Upload, Play, Loader2, AlertCircle, Image as ImageIcon, Sliders } from "lucide-react";

export const ModelSandbox: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Model step toggles
  const [runVehicle, setRunVehicle] = useState(true);
  const [runPlate, setRunPlate] = useState(true);
  const [runClassifier, setRunClassifier] = useState(true);
  const [runOcr, setRunOcr] = useState(true);

  const translatePlateTypeLao = (plateType: string) => {
    if (!plateType) return "ທົ່ວໄປ (General)";
    const type = plateType.toLowerCase();
    if (type.includes("private")) return "ສ່ວນຕົວ (Private)";
    if (type.includes("government") || type.includes("state")) return "ລັດຖະບານ (Government)";
    if (type.includes("business_100") || (type.includes("business") && type.includes("100%"))) return "ວິສາຫະກິດ 100% (Business 100%)";
    if (type.includes("business_1") || (type.includes("business") && type.includes("1%"))) return "ວິສາຫະກິດ 1% (Business 1%)";
    if (type.includes("public")) return "ສາທາລະນະ (Public)";
    if (type.includes("foreign")) return "ຕ່າງປະເທດ (Foreign)";
    if (type.includes("international") || type.includes("organization")) return "ອົງການຈັດຕັ້ງສາກົນ (International Organization)";
    if (type.includes("military") || type.includes("police")) return "ທະຫານ-ຕຳຫຼວດ (Military/Police)";
    return "ທົ່ວໄປ (General)";
  };

  const translatePlateTypeLaoOnly = (plateType: string) => {
    if (!plateType) return "ທົ່ວໄປ";
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

  const getPlateTypeBadgeStyle = (bg?: string, font?: string) => {
    if (!bg || !font) return "bg-slate-100 border-slate-300 text-slate-800 border shadow-sm font-bold text-sm px-4 py-2 rounded-xl";
    const bgLower = bg.toLowerCase();
    const fontLower = font.toLowerCase();
    
    let bgClass = "bg-slate-100 border-slate-300";
    
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
    
    return `${bgClass} border-2 shadow-sm font-bold text-sm px-6 py-2 rounded-xl`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  };

  const handleRun = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.scanFlexibleSandbox(
        file,
        runVehicle,
        runPlate,
        runOcr,
        runClassifier
      );
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Execution failed.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An error occurred during scanning. Check if your backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-hidden bg-slate-50 text-slate-800 h-full flex flex-col">
      <div className="max-w-[99%] mx-auto space-y-5 h-full flex flex-col overflow-hidden w-full">
        
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <Sliders className="text-sky-600 w-7 h-7" />
              AI Model Sandbox
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Selectively enable/disable neural network stages. <strong>Runs completely in-memory (no database records saved)</strong>.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl shadow-sm shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden min-h-0 pb-2">
          
          {/* Left panel: Model select switches & Upload */}
          <div className="lg:col-span-5 flex flex-col h-full overflow-hidden space-y-4 min-h-0">
            
            {/* Upload Zone */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
              <h3 className="font-bold text-slate-400 mb-3 text-xs uppercase tracking-wider shrink-0">
                1. Upload Test Target
              </h3>

              {!previewUrl ? (
                <label 
                  className="border-2 border-dashed border-slate-200 hover:border-sky-500/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/50 group flex-1 min-h-0"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <Upload className="w-10 h-10 text-slate-400 group-hover:text-sky-600 transition mb-2.5" />
                  <span className="text-sm font-bold text-slate-700">Drag & drop photo here</span>
                  <span className="text-xs text-slate-400 mt-1">or click to browse local files</span>
                </label>
              ) : (
                <div className="space-y-3 flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 shadow-inner flex-1 flex items-center justify-center min-h-0">
                    <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                  </div>
                  <button 
                    onClick={() => { setFile(null); setPreviewUrl(null); setResult(null); }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition shrink-0"
                  >
                    Change Image
                  </button>
                </div>
              )}
            </div>

            {/* Steps switches checkboxes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm shrink-0">
              <h3 className="font-bold text-slate-400 mb-3 text-xs uppercase tracking-wider">
                2. Configure Pipeline Steps
              </h3>

              <div className="space-y-3">
                
                {/* Vehicle Detector Switch (Step 1) */}
                <div 
                  onClick={() => setRunVehicle(!runVehicle)}
                  className="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl cursor-pointer hover:border-sky-500/30 transition hover:bg-slate-100/50"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Step 1</span>
                    <span className="text-sm font-semibold text-slate-800">ກວດຈັບລົດ (Vehicle Detector)</span>
                    <small className="text-slate-500 text-[10px] font-normal block mt-0.5">vehicle_detect.onnx</small>
                  </div>
                  <button 
                    type="button"
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${runVehicle ? 'bg-sky-600' : 'bg-slate-300'}`}
                  >
                    <span className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${runVehicle ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Plate Detector Switch (Step 2) */}
                <div 
                  onClick={() => setRunPlate(!runPlate)}
                  className="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl cursor-pointer hover:border-sky-500/30 transition hover:bg-slate-100/50"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Step 2</span>
                    <span className="text-sm font-semibold text-slate-800">ກວດຈັບປ້າຍລົດ (Plate Detector)</span>
                    <small className="text-slate-500 text-[10px] font-normal mt-0.5">vehicle_plate.onnx</small>
                  </div>
                  <button 
                    type="button"
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${runPlate ? 'bg-sky-600' : 'bg-slate-300'}`}
                  >
                    <span className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${runPlate ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Classifier Switch (Step 3) */}
                <div 
                  onClick={() => setRunClassifier(!runClassifier)}
                  className="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl cursor-pointer hover:border-sky-500/30 transition hover:bg-slate-100/50"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Step 3</span>
                    <span className="text-sm font-semibold text-slate-800">ແຍກປະເພດປ້າຍ (Plate Classifier)</span>
                    <small className="text-slate-500 text-[10px] font-normal mt-0.5">plate_classifier.onnx</small>
                  </div>
                  <button 
                    type="button"
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${runClassifier ? 'bg-sky-600' : 'bg-slate-300'}`}
                  >
                    <span className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${runClassifier ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Plate OCR Switch (Step 4) */}
                <div 
                  onClick={() => setRunOcr(!runOcr)}
                  className="flex items-center justify-between p-3.5 bg-slate-50/60 border border-slate-200 rounded-xl cursor-pointer hover:border-sky-500/30 transition hover:bg-slate-100/50"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Step 4</span>
                    <span className="text-sm font-semibold text-slate-800">ອ່ານຕົວອັກສອນປ້າຍ (Plate OCR)</span>
                    <small className="text-slate-500 text-[10px] font-normal mt-0.5">plate_text.onnx</small>
                  </div>
                  <button 
                    type="button"
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${runOcr ? 'bg-sky-600' : 'bg-slate-300'}`}
                  >
                    <span className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${runOcr ? 'translate-x-4.5' : 'translate-x-0'}`} />
                  </button>
                </div>

              </div>
            </div>

            {/* Run Button */}
            <button 
              onClick={handleRun}
              disabled={!file || isLoading}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Executing Sandbox...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Inference Sandbox
                </>
              )}
            </button>

          </div>

          {/* Right panel: Visual Output Results */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden min-h-0">
            
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex-1 flex flex-col overflow-hidden h-full min-h-0">
              <h3 className="font-bold text-slate-500 border-b border-slate-100 pb-2 mb-4 text-xs uppercase tracking-wider flex items-center gap-2 shrink-0">
                Output Sandbox Panel
              </h3>

              {!result && !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16 text-center">
                  <ImageIcon className="w-16 h-16 text-slate-200 stroke-[1.2] mb-3" />
                  <h4 className="font-bold text-slate-650 text-base">Awaiting Sandbox Run</h4>
                  <p className="text-xs max-w-[300px] mt-1 text-slate-400">Configure models on the left panel, upload a vehicle photo, and hit run.</p>
                </div>
              )}

              {isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 text-center gap-2">
                  <Loader2 className="animate-spin w-14 h-14 text-sky-600 mb-3" />
                  <h4 className="font-bold text-slate-700 text-base">Evaluating ONNX Models</h4>
                  <p className="text-xs max-w-[300px] text-slate-400">Connecting with in-memory models to compute predictions...</p>
                </div>
              )}

              {result && (
                <div className="space-y-5 flex-1 overflow-y-auto scroller pr-2 min-h-0">
                  
                  {/* Annotated Output Image */}
                  {result.annotated_image && (
                    <div className="space-y-2 text-left">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Annotated Image</h4>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 p-1.5 flex items-center justify-center max-h-[300px] shadow-sm">
                        <img src={result.annotated_image} alt="Inference Output" className="max-h-[280px] max-w-full object-contain rounded-lg" />
                      </div>
                    </div>
                  )}

                  {/* Character/Style/Box results */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    
                    {/* Bounding box list */}
                    {result.detections && result.detections.length > 0 && (
                      <div className="space-y-2 col-span-2 md:col-span-1">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detections ({result.detections.length})</h4>
                        <div className="space-y-2.5 max-h-[200px] overflow-y-auto scroller pr-1">
                          {result.detections.map((det: any, idx: number) => (
                            <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-sm">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-slate-800">{det.class_name || det.char}</span>
                                <code className="text-[10px] text-slate-400 font-mono">[{det.box.join(", ")}]</code>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-100 text-sky-700 font-extrabold text-[10px]">
                                {(det.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OCR values */}
                    {(result.text_en || result.text_lao) && (
                      <div className="space-y-2 col-span-2 md:col-span-1">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parsed Plate Characters</h4>
                        <div className="space-y-3">
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center shadow-sm">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Lao Character Sequence</span>
                            <span className="font-extrabold text-xl text-slate-800" style={{ fontFamily: "Noto Sans Lao, sans-serif" }}>
                              {result.text_lao}
                            </span>
                          </div>

                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center shadow-sm">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">English Sequence</span>
                            <span className="font-extrabold text-xl text-slate-800">
                              {result.text_en}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Style Badge Showcase */}
                    {result.predicted_style && (
                      <div className="space-y-3 col-span-2 flex flex-col items-center pt-4 border-t border-slate-200 w-full">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 self-start">Classification Output</h4>
                        
                        <div className="my-2 flex justify-center">
                          <span className={getPlateTypeBadgeStyle(result.bg_color, result.font_color)}>
                            {translatePlateTypeLaoOnly(result.predicted_style)}
                          </span>
                        </div>

                        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-4">
                          <div className="p-3 bg-slate-50 rounded-xl flex flex-col gap-0.5 border border-slate-200">
                            <span className="text-slate-455 text-[10px] text-slate-400 font-semibold">Plate Style Name:</span>
                            <strong className="text-slate-800 font-extrabold text-xs">
                              {translatePlateTypeLao(result.predicted_style)}
                            </strong>
                          </div>
                          
                          <div className="p-3 bg-slate-50 rounded-xl flex flex-col gap-0.5 border border-slate-200">
                            <span className="text-slate-455 text-[10px] text-slate-400 font-semibold">Style Class ID:</span>
                            <strong className="text-slate-700 font-extrabold text-xs font-mono">{result.predicted_style}</strong>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl flex flex-col gap-0.5 border border-slate-200">
                            <span className="text-slate-455 text-[10px] text-slate-400 font-semibold">Model Confidence:</span>
                            <strong className="text-sky-600 font-extrabold text-xs">{(result.confidence * 100).toFixed(0)}%</strong>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
