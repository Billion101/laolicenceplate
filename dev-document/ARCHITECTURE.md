# Lao License Plate Recognition System: Architecture & Workflow Guide

This document describes the high-level system architecture, database schema, component boundaries, and step-by-step logical workflow of the application. It is updated to reflect the transition from HSV color logic heuristics to a deep learning classification pipeline, dynamic tracking and update logic, the Sandbox architecture, and the standalone `new-redesign` testing sandbox.

---

## 1. System Architecture Overview

The system is split into three main layers: **React Frontend**, **FastAPI Backend**, and the **AI Processing Engine** running ONNX models with GPU (DirectML/CUDA) or CPU execution providers. Detections and audit images are persisted in **MongoDB** and local static directories.

```mermaid
graph TD
    Client[React TS Client] -->|1. HTTP POST Image| API_Image[scan.py: /api/v1/scan/image]
    Client -->|2. HTTP POST Video| API_VidUp[scan.py: /api/v1/scan/video/upload]
    Client -->|3. HTTP GET Stream| API_VidStr[scan.py: /api/v1/scan/video/stream]
    Client -->|4. HTTP POST Sandbox Form| API_Sandbox[scan.py: /api/v1/scan/flexible-pipeline]
    Client -->|5. HTTP GET Logs| API_Logs[scan.py: /api/v1/scan/logs]
    Client -->|6. HTTP DELETE Log/All| API_Del[scan.py: /api/v1/scan/delete/ & /clear-all]
    
    subgraph FastAPI Backend App
        API_Image --> AIService[ai_service.py: AIService Singleton]
        API_VidStr --> AIService
        API_Sandbox --> AIService
        AIService --> Pipeline[LicensePlatePipeline]
        API_Image --> DB_Log[log_detection_to_db]
        API_VidStr --> DB_Log
        DB_Log --> MongoDB[(MongoDB 'lao_plate')]
        DB_Log --> LocalDisk[(Local Disk Static Storage)]
    end
    
    subgraph AI Processing Engine
        Pipeline --> Stage1[vehicle_detect.onnx: Vehicle Detector]
        Pipeline --> Stage2[vehicle_plate.onnx: Plate Detector]
        Pipeline --> NMS_Crops[IoU NMS: Crop Duplicate Filter]
        Pipeline --> Stage3[ocr_utils.py: Deskew & Rotation]
        Pipeline --> Stage4[plate_text.onnx: Character Reader]
        Pipeline --> Stage5[plate_classifier.onnx: Deep Learning Type Classifier]
        Pipeline --> Stage6[Heuristic Context Rules: IO vs Business 1%]
        Pipeline --> Stage7[visual_utils.py: Draw Visual Overlays]
    end
```

---

## 2. Step-by-Step AI Core Detection Logic

When an image is sent to the AI engine, it processes the image in **8 logical steps** to locate vehicles, read license plates, and identify registry categories:

```mermaid
graph TD
    %% Define Styles for visual friendliness
    classDef input fill:#f1f5f9,stroke:#cbd5e1,stroke-width:2px,stroke-dasharray: 4 4;
    classDef step fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,rx:8px,ry:8px;
    classDef output fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,rx:8px,ry:8px;

    %% Nodes
    Inp["📸 Input Image / Video Frame"]:::input
    
    Step1["🚗 1. Find Vehicles<br/><i>(Locates cars, trucks, buses via vehicle_detect.onnx)</i>"]:::step
    Step2["🏷️ 2. Locate Plates<br/><i>(Finds plate boxes inside vehicles via vehicle_plate.onnx)</i>"]:::step
    Step3["🗑️ 3. Crop Duplicate Filter (NMS)<br/><i>(Filters overlapping plate crops before expensive OCR)</i>"]:::step
    Step4["🔄 4. Rotate & Align (Deskew)<br/><i>(Corrects camera tilts and angles)</i>"]:::step
    Step5["🔍 5. Read Plate Characters (OCR)<br/><i>(Reads characters via plate_text.onnx & matches provinces/digits)</i>"]:::step
    Step6["🎨 6. Classify Plate Type<br/><i>(Deep learning classifier plate_classifier.onnx)</i>"]:::step
    Step7["🧩 7. Hybrid Context Rules<br/><i>(Validates type details e.g., IO vs Business 1% using OCR text)</i>"]:::step
    Step8["🖼️ 8. Draw Visual Overlays<br/><i>(Draws bounding boxes and text cards)</i>"]:::step
    
    Out["✅ Final Scan Result & DB Log Entry"]:::output

    %% Flow connections
    Inp --> Step1
    Step1 -->|Vehicle Crop| Step2
    Step2 --> Step3
    Step3 -->|Filtered Plate Crop| Step4
    Step4 -->|Aligned Plate| Step5
    Step5 -->|OCR Text & Boxes| Step6
    Step6 --> Step7
    Step7 --> Step8
    Step8 --> Out
```

### 1. Find the Vehicles 🚗
*   **What it does:** Scans the full image using `vehicle_detect.onnx` to locate cars, buses, and trucks (COCO classes `2`, `5`, `7`).
*   **Why we do it:** To limit false positives. Standard background noise (e.g. billboards, fences) can resemble license plates. Locating the vehicle first restricts plate searches to valid vehicle contexts.

### 2. Locate the License Plates 🏷️
*   **What it does:** Runs `vehicle_plate.onnx` on each vehicle bounding box crop. If no vehicles are found, the pipeline scans the entire image as a fallback.
*   **Why we do it:** Localizing the search inside a crop is faster and yields higher resolution boundaries for tilted or distant plates.

### 3. Crop Duplicate Filter (NMS) 🗑️
*   **What it does:** Evaluates candidate plate bounding boxes using a custom **Intersection over Union (IoU) Non-Maximum Suppression** filter (suppresses boxes with IoU $> 0.4$).
*   **Why we do it:** Prevents double-processing and double-logging when multiple overlapping boxes are generated for the same physical plate.

### 4. Rotate & Align the Plate (Deskewing) 🔄
*   **What it does:** Iterates through a set of candidate rotation angles (`0`, `-5`, `5`, `-10`, `10` degrees) and feeds the rotated crop to the OCR model. The angle yielding the highest confidence score is selected.
*   **Why we do it:** Tilted cameras introduce reading errors. Straightening the characters beforehand significantly improves OCR accuracy.

### 5. Read Plate Characters (OCR) 🔍
*   **What it does:** Runs `plate_text.onnx` on the straightened plate crop, translates predicted character classes to Lao script characters, groups characters into lines, and corrects logical lookalikes (e.g., swapping `O` and `0` contextually). Abbreviated English provinces (e.g., `VTE`) are matched to full Lao descriptions.

### 6. Classify Plate Registry Type 🎨
*   **What it does:** Runs the deep learning model `plate_classifier.onnx` (trained as a YOLOv8-classify model) to output a probability vector across registry styles.
*   **Why we do it:** Former HSV-based color rules were sensitive to exposure, dirt, glare, and shadow. Deep learning classifiers look at global visual texture and color distributions, boosting robustness.

### 7. Hybrid Context Rules 🧩
*   **What it does:** Refines predictions using OCR context. For example, both **Business 1%** and **International Organization** plates have white backgrounds with blue text. The system checks character boxes for Lao province text: if present, it is mapped to **Business 1%**; if absent, it is mapped to **International Organization** (which do not have province indicators).

### 8. Draw Visual Overlays 🖼️
*   **What it does:** Scales coordinates back to original image boundaries and overlays vehicle bounding boxes (green), plate bounding boxes (color-coded by type), and text result cards.

---

## 3. Data Flow & Integration (AI ➔ Backend ➔ DB ➔ Frontend)

### Phase 1: Upload & Inference (Static Scan)
1.  **Frontend Upload:** The user uploads an image under the **Scan Image** tab. The client posts the file payload to `POST /api/v1/scan/image`.
2.  **API Handler:** The backend router [scan.py](file:///c:/Users/billi/Desktop/laolicenceplates/code/backend/app/routers/scan.py) decodes the image bytes and passes the image array to the singleton `AIService` pipeline.
3.  **Inference:** The AI pipeline executes the detection cascade using DirectML/CUDA GPU acceleration, writes the annotated visual overlays, and returns a JSON payload containing base64 output representations and metadata.

### Phase 2: Logging & Persistence
4.  **Local Storage:** The backend extracts the cropped license plate and vehicle arrays, saving them as JPG files locally in the static folders:
    *   `backend/static/plates/{id}.jpg`
    *   `backend/static/vehicles/{id}.jpg`
5.  **Database Storage:** The scan metadata, colors, confidence scores, and relative URLs are saved to the MongoDB `plate_logs` collection.

### Phase 3: Video Upload & Real-Time Tracking
1.  **Video Upload:** Pre-recorded videos are uploaded via `POST /api/v1/scan/video/upload` and stored in `backend/temp/`.
2.  **Streaming Loop:** The frontend requests `GET /api/v1/scan/video/stream?filename={temp_filename}` within an `<img>` element. The backend streams frames as an MJPEG block (`multipart/x-mixed-replace`) at ~30 FPS.
3.  **Sequential Match De-duplication:** To prevent multiple duplicate database logs from a continuous video stream, the backend maintains a sliding cache (`RECENT_DETECTIONS`). If a plate matches an existing record (by OCR similarity or spatial box overlap `IoU > 0.4`):
    *   If the new frame has a **higher confidence score**, the existing MongoDB document is updated with the new cropped images and metadata.
    *   Otherwise, the frame is annotated and streamed, but duplicate logging is suppressed.

### Phase 4: Model Sandbox (Step-by-Step Testing)
1.  **Tab Interface:** The **Model Sandbox** tab lets developers upload images and toggle pipeline components (Vehicle, Plate, OCR, Classifier) individually.
2.  **Stateless Endpoint:** The frontend calls `POST /api/v1/scan/flexible-pipeline`, which processes the toggled steps dynamically and returns bounding boxes and badges **without writing logs to MongoDB or saving files to disk**.

---

## 4. Database Schema (MongoDB `plate_logs`)

Each logged record in the database follows this structure:

```json
{
  "_id": ObjectId("6a32d385b736b71dd10aa4b3"),
  "timestamp": 1781883845.123,
  "ocr_en": "VTE | A R 0 0 9 3",
  "ocr_lao": "ນະຄອນຫຼວງວຽງຈັນ (Vientiane) | ກ ພ 0 0 9 3",
  "bg_color": "Yellow",
  "font_color": "Black",
  "plate_type": "Private License Plate (Yellow bg, Black text)",
  "confidence": 0.88,
  "image_url": "/static/plates/6a32d385b736b71dd10aa4b3.jpg",
  "vehicle_image_url": "/static/vehicles/6a32d385b736b71dd10aa4b3.jpg"
}
```

---

## 5. Standalone Model Validation Sandbox (`new-redesign/`)

Located in `/new-redesign`, this subdirectory contains an isolated model testing application.
*   **Purpose:** Decouples inference code from database environments, enabling fast verification of individual model parameters and weights.
*   **No DB Dependency:** Operates completely without MongoDB or file writes, hosting its own lightweight React client and Uvicorn FastAPI server on port `8001`.

---

## 6. Summary of Main Code Files

*   **[pipeline.py (AI)](file:///c:/Users/billi/Desktop/laolicenceplates/code/AI/src/pipeline.py):** Master orchestration pipeline containing the cascade inference structure and IoU NMS filter.
*   **[ocr_utils.py (AI)](file:///c:/Users/billi/Desktop/laolicenceplates/code/AI/src/ocr_utils.py):** Deskewing, rotation processing, line grouping, province matching, and character lookalike corrections.
*   **[scan.py (Backend)](file:///c:/Users/billi/Desktop/laolicenceplates/code/backend/app/routers/scan.py):** Router containing endpoints for static scans (`/image`), history logs (`/logs`), delete and purge routes (`/delete/{log_id}`, `/clear-all`), and the stateless sandbox `/flexible-pipeline`.
*   **[ModelSandbox.tsx (Frontend)](file:///c:/Users/billi/Desktop/laolicenceplates/code/frontend/src/components/ModelSandbox.tsx):** Interactive dashboard interfacing with the backend's flexible sandbox route.
*   **[VideoScanner.tsx (Frontend)](file:///c:/Users/billi/Desktop/laolicenceplates/code/frontend/src/components/VideoScanner.tsx):** Dashboard for video uploads and processed MJPEG stream display.
*   **[color_utils.py (AI) [DEPRECATED]](file:///c:/Users/billi/Desktop/laolicenceplates/code/AI/src/color_utils.py):** Former HSV color segmentation scripts, now deprecated following the integration of the deep learning classifier.
