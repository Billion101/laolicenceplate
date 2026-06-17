# Lao License Plate Project Setup Guide

This document describes how to set up, install dependencies, and run all components of the project on both **Windows** and **macOS / Linux**.

The project consists of three core components:
1. **AI Module (`AI/`)**: Python-based YOLOv8 license plate and character detection pipeline.
2. **Backend (`backend/`)**: FastAPI server that handles scan endpoints and logs detections to MongoDB.
3. **Frontend (`frontend/`)**: React + TypeScript client built on Vite.

---

## Prerequisites
Before you start, make sure you have installed:
1. **Python 3.8 - 3.11** (Ensure Python is added to your environment `PATH`).
2. **Node.js** (v18 or higher, along with `npm`).
3. **MongoDB Community Server** (Running locally on the default port `27017`).

---

## 1. MongoDB Database Setup

The backend expects MongoDB to be running locally on `mongodb://localhost:27017`.

*   **Windows:** 
    Ensure the MongoDB service is running. You can check this in the **Services** application, or run this command in Administrator Command Prompt:
    ```cmd
    net start MongoDB
    ```
*   **macOS (Homebrew):**
    Start the MongoDB service using brew:
    ```bash
    brew services start mongodb-community
    ```

---

## 2. AI Core Module Setup

The AI core handles the core image processing, color checking, and YOLOv8 ONNX inference.

### Windows (PowerShell)
```powershell
# Navigate to the AI directory
cd AI

# Create the virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Run the test pipeline script
python main.py
```

### macOS / Linux (Terminal)
```bash
# Navigate to the AI directory
cd AI

# Create the virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run the test pipeline script
python main.py
```

---

## 3. Backend Setup (FastAPI)

The backend exposes REST APIs for single-image scans, video uploads, and history logs.

### Windows (PowerShell)
```powershell
# Navigate to the backend directory
cd backend

# Create the virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Start the FastAPI server (Hot reloading enabled)
python run.py
```

### macOS / Linux (Terminal)
```bash
# Navigate to the backend directory
cd backend

# Create the virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start the FastAPI server
python run.py
```

The backend API will run on `http://localhost:8000`. You can access interactive Swagger documentation at `http://localhost:8000/docs`.

---

## 4. Frontend Setup (React + Vite)

The frontend is a web client interface that allows users to upload images/videos and inspect detection logs in real time.

### Windows & macOS (Common Commands)
```bash
# Navigate to the frontend directory
cd frontend

# Install Node modules
npm install

# Start the local React Vite development server
npm run dev
```

The frontend application will boot by default on `http://localhost:5173`. Open this URL in your web browser to interact with the application.

---

## 5. GPU Acceleration Setup (Windows)

If you have a dedicated graphics card (like an NVIDIA RTX series card), you can run the ONNX models on the GPU instead of the CPU. This speeds up plate detection and OCR significantly.

### Option A: DirectML (Easiest - Works instantly on RTX, AMD, or Intel GPUs)
DirectML runs on any DirectX 12 compatible card. It does **not** require installing any CUDA Toolkit or SDKs.

To set up DirectML:
1. Open PowerShell and navigate to the directory (`AI` or `backend`).
2. Activate the virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
3. Swap the CPU onnxruntime package for DirectML:
   ```powershell
   pip uninstall onnxruntime -y
   pip install onnxruntime-directml
   ```
4. Run the application. It will automatically detect your GPU and print:
   ```text
   Using ONNX Runtime with DmlExecutionProvider
   ```

### Option B: CUDA (Fastest - NVIDIA GPUs only)
This provides the maximum performance but requires installing the **NVIDIA CUDA Toolkit** (v11.x or v12.x) and **cuDNN** libraries on your Windows operating system.

To set up CUDA:
1. Activate the virtual environment (`.\.venv\Scripts\Activate.ps1`).
2. Swap the CPU package for GPU:
   ```powershell
   pip uninstall onnxruntime -y
   pip install onnxruntime-gpu
   ```
3. Verify that the GPU provider is recognized:
   ```powershell
   python -c "import onnxruntime as ort; print(ort.get_available_providers())"
   # Output should list: 'CUDAExecutionProvider'
   ```

