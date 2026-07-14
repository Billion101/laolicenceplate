export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface Detection {
  plate_index: number;
  box: [number, number, number, number];
  confidence: number;
  style: string;
  ocr_en: string;
  ocr_lao: string;
  bg_color: string;
  font_color: string;
  plate_type: string;
  image_url?: string;
  vehicle_image_url?: string;
}

export interface ScanImageResponse {
  success: boolean;
  detections_count: number;
  detections: Detection[];
  annotated_image: string;
  error?: string;
}

export interface LogRecord {
  _id: string;
  timestamp?: number;
  ocr_en: string;
  ocr_lao: string;
  bg_color: string;
  font_color: string;
  plate_type: string;
  confidence: number;
  image_url: string;
  vehicle_image_url?: string;
}

export const api = {
  /**
   * Scan a single image file
   */
  async scanImage(file: File): Promise<ScanImageResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BACKEND_URL}/api/v1/scan/image`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API scanning failed with status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get scanned plate logs from MongoDB database
   */
  async getLogs(limit: number = 50): Promise<LogRecord[]> {
    const response = await fetch(`${BACKEND_URL}/api/v1/scan/logs?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch logs from server");
    }

    return response.json();
  },

  /**
   * Upload video file for processing
   */
  async uploadVideo(file: File): Promise<{ success: boolean; filename?: string; error?: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BACKEND_URL}/api/v1/scan/video/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Video upload failed with status: ${response.status}`);
    }

    return response.json();
  },



  /**
   * Get video streaming scan endpoint URL
   */
  getVideoStreamUrl(filename: string): string {
    return `${BACKEND_URL}/api/v1/scan/video/stream?filename=${encodeURIComponent(filename)}`;
  },

  /**
   * Delete a single scan log record by ID
   */
  async deleteLog(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const response = await fetch(`${BACKEND_URL}/api/v1/scan/delete/${id}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      throw new Error(`Deletion failed with status: ${response.status}`);
    }
    
    return response.json();
  },

  /**
   * Run sandbox inference with flexible model choice
   */
  async scanFlexibleSandbox(
    file: File,
    runVehicle: boolean,
    runPlate: boolean,
    runOcr: boolean,
    runClassifier: boolean
  ): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("run_vehicle", runVehicle.toString());
    formData.append("run_plate", runPlate.toString());
    formData.append("run_ocr", runOcr.toString());
    formData.append("run_classifier", runClassifier.toString());

    const response = await fetch(`${BACKEND_URL}/api/v1/scan/flexible-pipeline`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Flexible sandbox failed with status: ${response.status}`);
    }

    return response.json();
  }
};

