# Lao License Plate Recognition & Classification System (LPR)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00FFFF.svg?style=flat&logo=ultralytics&logoColor=white)](https://ultralytics.com)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-DirectML_%7C_CUDA-005CED.svg?style=flat&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Async_Motor-47A248.svg?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

An end-to-end, high-performance Intelligent Transportation System (ITS) tailored specifically for **Lao PDR license plates**. The system features a **4-stage deep learning cascade** for vehicle detection, license plate localization, Lao script OCR, and deep learning plate style & color classification, coupled with an asynchronous FastAPI backend and a modern React + Vite dashboard.

---

## 📑 Table of Contents

- [1. System Architecture & Workflow](#1-system-architecture--workflow)
- [2. 4-Stage Deep Learning Pipeline](#2-4-stage-deep-learning-pipeline)
- [3. Lao License Plate Categories](#3-lao-license-plate-categories)
- [4. Core Application Features](#4-core-application-features)
- [5. Quick Start & Setup Guide](#5-quick-start--setup-guide)
  - [Prerequisites](#prerequisites)
  - [Step 0: Download AI Model Weights](#step-0-download-ai-model-weights)
  - [Step 1: Start MongoDB](#step-1-start-mongodb)
  - [Step 2: AI Engine Setup](#step-2-ai-engine-setup)
  - [Step 3: Backend Server (FastAPI)](#step-3-backend-server-fastapi)
  - [Step 4: Frontend Client (React + Vite)](#step-4-frontend-client-react--vite)
  - [Hardware & GPU Acceleration (DirectML / CUDA)](#hardware--gpu-acceleration-directml--cuda)
- [6. REST API Reference](#6-rest-api-reference)
- [7. Project Directory Structure](#7-project-directory-structure)
- [8. Documentation & References](#8-documentation--references)

---

## 1. System Architecture & Workflow

The platform links a modern user interface to a high-speed inference pipeline with database auditing:

```
┌─────────────────────────────────────────────────────────────┐
│                    React 19 + Vite Frontend                 │
│   (Video Stream • Image Scanner • Model Sandbox • Logs)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST / MJPEG Stream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend Server                   │
│   • Singleton AI Model Provider (Memory/GPU Warming)        │
│   • Asynchronous Motor MongoDB Logger                       │
│   • Levenshtein Fuzzy Plate Deduplication & Static Host     │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│       AI ONNX Pipeline       │   │    Storage & Database    │
│  1. Vehicle Detector         │   │  • MongoDB ('lao_plate') │
│  2. Plate Detector           │   │  • Local Static Crops    │
│  3. Character OCR + Deskew   │   │    (/static/plates/)     │
│  4. Deep Plate Classifier    │   └──────────────────────────┘
└──────────────────────────────┘
```

---

## 2. 4-Stage Deep Learning Pipeline

Instead of a single monolithic model, the AI engine uses a sequential **4-stage YOLOv8 cascade** in ONNX format:

```
Input Image / Frame
       │
       ▼
[Model 1: vehicle_detect.onnx] ──► Detects cars, buses, trucks (filters false positives)
       │
       ▼ (Crop Vehicle)
[Model 2: vehicle_plate.onnx]  ──► Locates license plate boundaries (high/low confidence retry)
       │
       ▼ (IoU NMS Filter & Crop)
[Deskewing & Tilt Correction]  ──► Evaluates angles [-10°, -5°, 0°, 5°, 10°] to straighten plates
       │
       ├──────────────────────────────────────────┐
       ▼                                          ▼
[Model 3: plate_text.onnx]             [Model 4: plate_classifier.onnx]
Reads characters & province codes      Direct deep learning plate style classification
       │                                          │
       ▼                                          ▼
[Smart Post-Processing]                [Context Disambiguation]
• Letter/Digit boundary penalty        • Resolves Business 1% vs International Org
• Lookalike swap (O↔0, I↔1, B↔8)       • Maps to background & text color palette
• Lao alphabet mapping (A➔ກ, B➔ຂ)      • Generates badge metadata
• Province translation (VTE➔ນະຄອນຫຼວງ)
       │                                          │
       └────────────────────┬─────────────────────┘
                            ▼
           Annotated Visual Overlay & DB Payload
```

1. **Vehicle Detection (`vehicle_detect.onnx`)**: Filters the search window to vehicles (Car, Bus, Truck), eliminating false positives from signs or roadside clutter.
2. **License Plate Detection (`vehicle_plate.onnx`)**: Locates the plate with adaptive high-to-low confidence retries and IoU non-maximum suppression (NMS) to eliminate duplicate crops.
3. **Deskewing & Character OCR (`plate_text.onnx`)**: 
   - Dynamically checks rotation angles `[-10, -5, 0, 5, 10]` degrees to select the highest-scoring alignment.
   - Groups characters into lines and uses penalty algorithms to distinguish letter prefixes from digit sequences.
   - Maps English character predictions to full Lao script (`LAO_LETTER_MAP`) and Lao provinces (`LAO_PROVINCE_MAP`).
4. **Plate Type Classifier (`plate_classifier.onnx`)**: 
   - Replaces fragile manual HSV color rules with an end-to-end deep learning classifier trained across Lao plate formats.
   - Applies hybrid contextual rules (e.g., distinguishing White/Blue Business 1% plates from International Organization plates based on province presence).

---

## 3. Lao License Plate Categories

Lao vehicle plates use specific background and font color schemes to denote registry status:

| Predicted Class | Official Plate Name | Background | Font | Purpose / Vehicle Owner |
| :--- | :--- | :--- | :--- | :--- |
| `private` | **Private License Plate** | 🟡 Yellow | ⚫ Black | General citizens and privately owned vehicles |
| `government` / `state` | **Government License Plate** | 🔵 Blue | ⚪ White | Government bodies, ministries, and state officials |
| `business_100` | **Business Plate (100%)** | ⚪ White | ⚫ Black | Commercial companies, logistics, registered businesses |
| `business_1` | **Business Plate (1%)** | ⚪ White | 🔵 Blue | Joint-venture, foreign investment, concession businesses |
| `military_police` / `public` | **Military / Police Plate** | 🔴 Red | ⚪ White | National Defense and Public Security forces |
| `foreign` | **Foreign License Plate** | 🟡 Yellow | 🔵 Blue | Foreign embassies, diplomats, consular staff |
| `international_organization` | **International Org Plate** | ⚪ White | 🔵 Blue | UN agencies, NGOs, international aid missions |

---

## 4. Core Application Features

### 🎥 Process Video (Real-time Stream)
- Upload `.mp4`, `.avi`, or `.mov` vehicle surveillance footage.
- Streams live annotated video frames using high-speed MJPEG over HTTP.
- Detects, tracks, and logs vehicles in real time with duplicate cooldown tracking.

### 🖼️ Scan Image
- Drag-and-drop or file upload for single or batch images.
- Instant bounding box display with confidence scores, recognized Lao & English text, and plate category badges.
- Automatically saves high-resolution crops of the vehicle and plate to MongoDB and disk.

### 🎛️ Model Sandbox (Interactive Testing)
- Built-in developer diagnostic lab to test the 4 models independently or in custom combinations:
  - Toggle **Vehicle Detection** on/off
  - Toggle **Plate Detection** on/off
  - Toggle **Character OCR** on/off
  - Toggle **Plate Classifier** on/off
- Inspect raw model confidence, intermediate bounding boxes, and execution times without persisting test artifacts to the database.

### 📊 Plate Database & Audit History
- Real-time audit log of all scanned vehicles.
- Filter by date, plate type, Lao text, or English transcription.
- Inspect crop thumbnails, confidence metrics, and delete individual logs or wipe all history.

---

## 5. Quick Start & Setup Guide

### Prerequisites

Make sure you have the following installed on your machine:
- **Python 3.8 – 3.11** (Ensure `python` and `pip` are added to your system `PATH`)
- **Node.js 18+** & **npm**
- **MongoDB Community Server** (Running on default port `27017`)
- *(Optional)* Windows DirectX 12 compatible GPU or NVIDIA GPU with CUDA for acceleration

---

### Step 0: Download AI Model Weights

Before running the AI pipeline or backend, you must download the 4 trained ONNX models and place them inside the **`AI/models/`** directory.

> [!IMPORTANT]
> 📥 **Model Download Link:** [Download models.zip (Google Drive)](https://drive.google.com/file/d/1L2XQPgSc1nFCwb7LguVn9-rI2oy9o2z2/view?usp=sharing)

Once downloaded, extract the archive or place the 4 `.onnx` files into the `AI/models/` folder as follows:

```text
AI/models/
├── vehicle_detect.onnx       # Stage 1: Vehicle Detector
├── vehicle_plate.onnx        # Stage 2: Plate Detector
├── plate_text.onnx           # Stage 3: Character OCR Model
└── plate_classifier.onnx     # Stage 4: Plate Style Classifier
```

---

### Step 1: Start MongoDB

The backend connects to MongoDB at `mongodb://localhost:27017`.

- **Windows**:
  ```cmd
  net start MongoDB
  ```
- **macOS (Homebrew)**:
  ```bash
  brew services start mongodb-community
  ```
- **Linux (systemd)**:
  ```bash
  sudo systemctl start mongod
  ```

---

### Step 2: AI Engine Setup

You can run the AI standalone test to verify model weights and inference before starting the web servers.

**Windows (PowerShell):**
```powershell
cd AI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

**macOS / Linux (Bash):**
```bash
cd AI
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

### Step 3: Backend Server (FastAPI)

The backend handles the REST APIs, model warming, static image hosting, and database logging.

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

**macOS / Linux (Bash):**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

- Backend API will start on: **`http://localhost:8000`**
- Interactive Swagger API Docs: **`http://localhost:8000/docs`**
- Alternative ReDoc: **`http://localhost:8000/redoc`**

---

### Step 4: Frontend Client (React + Vite)

The frontend connects to `http://localhost:8000` by default (configurable via `VITE_BACKEND_URL` in `.env`).

```bash
cd frontend
npm install
npm run dev
```

- The React portal will open on: **`http://localhost:5173`**

---

### Hardware & GPU Acceleration (DirectML / CUDA)

By default, the ONNX models run using standard CPU execution. To leverage your dedicated graphics card:

#### Option A: DirectML (Recommended for Windows)
Works with **NVIDIA RTX, AMD Radeon, and Intel Arc GPUs** without installing CUDA or SDK toolkits:
```powershell
# Inside backend/.venv or AI/.venv:
pip uninstall onnxruntime -y
pip install onnxruntime-directml
```

#### Option B: CUDA (NVIDIA GPUs only)
Requires NVIDIA CUDA Toolkit (11.x or 12.x) and cuDNN installed:
```powershell
# Inside backend/.venv or AI/.venv:
pip uninstall onnxruntime -y
pip install onnxruntime-gpu
```

---

## 6. REST API Reference

| Method | Endpoint | Description | Query / Body Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/scan/image` | Scan a static image, save crops, and log to MongoDB | Form-data: `file` |
| `POST` | `/api/v1/scan/video/upload` | Upload a video for frame-by-frame analysis | Form-data: `file` |
| `GET` | `/api/v1/scan/video/stream` | Stream processed video with MJPEG live bounding boxes | `?filename=<uploaded_filename>` |
| `POST` | `/api/v1/scan/flexible-pipeline` | Sandbox inference testing without saving to DB | Form-data: `file`, `run_vehicle`, `run_plate`, `run_ocr`, `run_classifier` |
| `GET` | `/api/v1/scan/logs` | Fetch detection history from MongoDB | `?limit=50` |
| `DELETE`| `/api/v1/scan/delete/{log_id}` | Delete a single detection record and image crops | Path: `log_id` |
| `DELETE`| `/api/v1/scan/clear-all` | Delete all detection records and clear crop files | None |
| `GET` | `/` | API health check status | None |

---

## 7. Project Directory Structure

```text
laolicenceplate/
├── AI/                                 # AI Processing Engine & Standalone CLI
│   ├── models/                         # Trained ONNX weights
│   │   ├── vehicle_detect.onnx         # YOLOv8 Vehicle Detector
│   │   ├── vehicle_plate.onnx          # YOLOv8 Plate Detector
│   │   ├── plate_text.onnx             # YOLOv8 Character OCR Model
│   │   └── plate_classifier.onnx       # YOLOv8 Plate Style Classifier
│   ├── src/
│   │   ├── config.py                   # Model paths, thresholds & Lao character maps
│   │   ├── pipeline.py                 # Core 4-stage LicensePlatePipeline orchestrator
│   │   ├── ocr_utils.py                # Deskewing, rotation scoring & Lao OCR logic
│   │   └── visual_utils.py             # Visual overlay & bounding box renderers
│   ├── test_images/                    # Benchmark vehicle and plate images
│   ├── main.py                         # Standalone batch test runner
│   └── requirements.txt                # AI core dependencies
│
├── backend/                            # FastAPI Server & Database Service
│   ├── app/
│   │   ├── main.py                     # App factory, lifespan & router mounting
│   │   ├── config.py                   # MongoDB URI & system paths
│   │   ├── db.py                       # Async Motor MongoDB connection manager
│   │   ├── routers/
│   │   │   └── scan.py                 # Core routes: image, video, sandbox, logs
│   │   └── services/
│   │       └── ai_service.py           # AIService singleton wrapper (preloads models)
│   ├── static/plates/                  # Stored cropped plate & vehicle images
│   ├── temp/                           # Temporary buffer for video streaming
│   ├── run.py                          # Uvicorn launcher
│   └── requirements.txt                # Backend dependencies
│
├── frontend/                           # React 19 + TypeScript + Vite UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx              # Top navigation bar
│   │   │   ├── VideoScanner.tsx        # Video upload & live stream player
│   │   │   ├── ImageScanner.tsx        # Image drag-and-drop & detection cards
│   │   │   ├── ModelSandbox.tsx        # Flexible multi-model developer sandbox
│   │   │   └── PlateDatabase.tsx       # MongoDB audit logs & record management
│   │   ├── services/
│   │   │   └── api.ts                  # Axios/Fetch API client functions
│   │   ├── App.tsx                     # Main layout & tab router
│   │   └── index.css                   # Tailwind CSS styling
│   ├── package.json                    # Frontend package dependencies
│   └── vite.config.ts                  # Vite build configuration
│
├── dev-document/                       # In-depth architectural documentation
│   ├── ARCHITECTURE.md                 # Full system architecture & dataflow diagrams
│   ├── SETUP.md                        # Extended cross-platform setup details
│   ├── AI/                             # AI pipeline specifics & classifier guide
│   ├── backend/                        # Backend architecture notes
│   └── frontend/                       # Frontend component design specs
│
├── .gitignore                          # Git ignore rules
└── README.md                           # Project documentation (This file)
```

---

## 8. Documentation & References

For comprehensive internal documentation, refer to the guides in [`dev-document/`](dev-document/):

- 📖 [System Architecture & Dataflow](dev-document/ARCHITECTURE.md)
- 📖 [Extended Setup & Installation Guide](dev-document/SETUP.md)
- 📖 [AI Pipeline Architecture & Logic](dev-document/AI/README.md)
- 📖 [Deep Learning Plate Classifier Guide](dev-document/AI/PLATE_TYPE_LOGIC.md)
- 📖 [FastAPI Backend Documentation](dev-document/backend/README.md)
- 📖 [React Frontend Documentation](dev-document/frontend/README.md)
